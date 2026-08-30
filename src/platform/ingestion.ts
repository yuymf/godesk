import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export const INGESTION_LIMITS = {
  maxRulebookBytes: 25 * 1024 * 1024,
  maxAssetFileBytes: 25 * 1024 * 1024,
  maxAssetBytes: 100 * 1024 * 1024,
  maxAssetFiles: 40,
  maxGenerationImages: 8,
  maxGenerationImageDataUrlLength: 100_000,
  maxPdfPages: 200,
} as const;

export type SourceRole = "rulebook" | "asset";
export type GenerationRunStatus =
  | "ingesting"
  | "ready-for-compilation"
  | "failed";

export interface SourceAnchor {
  fileId: string;
  fileName: string;
  pageNumber?: number;
}

export interface ExtractedPage {
  id: string;
  kind: "pdf-page";
  sourceAnchor: SourceAnchor;
  text: string;
  width: number;
  height: number;
  hasEmbeddedImage: boolean;
  preview: Blob;
}

export interface ExtractedImage {
  id: string;
  kind: "image";
  sourceAnchor: SourceAnchor;
  width: number;
  height: number;
  image: Blob;
}

export type ExtractedArtifact = ExtractedPage | ExtractedImage;

export interface IngestedSourceFile {
  id: string;
  role: SourceRole;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  original: Blob;
  artifacts: ExtractedArtifact[];
}

export interface GenerationRun {
  id: string;
  status: GenerationRunStatus;
  createdAt: string;
  updatedAt: string;
  privacy: "browser-local";
  retention: "until-player-deletes-browser-data";
  sources: IngestedSourceFile[];
  error?: string;
}

export interface IngestionInput {
  rulebook: File;
  assets: File[];
}

export interface IngestionProgress {
  currentFile: string;
  completedFiles: number;
  totalFiles: number;
}

const PDF_TYPES = new Set(["application/pdf"]);
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const TEXT_TYPES = new Set(["text/plain", "text/markdown"]);

function extension(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function normalizedMimeType(file: Pick<File, "name" | "type">) {
  if (file.type) return file.type.toLowerCase();
  const fileExtension = extension(file.name);
  if (fileExtension === "pdf") return "application/pdf";
  if (fileExtension === "jpg" || fileExtension === "jpeg") return "image/jpeg";
  if (fileExtension === "png") return "image/png";
  if (fileExtension === "webp") return "image/webp";
  if (fileExtension === "gif") return "image/gif";
  if (fileExtension === "txt") return "text/plain";
  if (fileExtension === "md" || fileExtension === "markdown") return "text/markdown";
  return "";
}

export function validateRulebookFile(file: File) {
  const mimeType = normalizedMimeType(file);
  if (!PDF_TYPES.has(mimeType) && !TEXT_TYPES.has(mimeType)) {
    return "规则文档必须是 PDF、TXT 或 Markdown 文件。";
  }
  if (file.size === 0) return "规则文档是空文件。";
  if (file.size > INGESTION_LIMITS.maxRulebookBytes) {
    return "规则文档不能超过 25 MB。";
  }
  return "";
}

export async function extractRulebookText(file: File) {
  const validationError = validateRulebookFile(file);
  if (validationError) throw new Error(validationError);
  const mimeType = normalizedMimeType(file);
  if (TEXT_TYPES.has(mimeType)) return file.text();

  const buffer = await file.arrayBuffer();
  assertPdfHeader(new Uint8Array(buffer), file.name);
  let loadingTask: PDFDocumentLoadingTask | undefined;
  try {
    const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    loadingTask = getDocument({ data: new Uint8Array(buffer) });
    const pdfDocument = await loadingTask.promise;
    if (pdfDocument.numPages > INGESTION_LIMITS.maxPdfPages) {
      throw new Error(`${file.name} 有 ${pdfDocument.numPages} 页，超过 200 页限制。`);
    }
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      );
      page.cleanup();
    }
    const text = pages.map((page, index) => `[Page ${index + 1}]\n${page}`).join("\n\n").trim();
    if (!text) throw new Error(`${file.name} 没有可提取的文本。`);
    return text.slice(0, 100_000);
  } finally {
    await loadingTask?.destroy();
  }
}

export function validateSourceBundle(input: IngestionInput) {
  const errors: string[] = [];
  const rulebookType = normalizedMimeType(input.rulebook);

  if (!PDF_TYPES.has(rulebookType)) {
    errors.push("规则书必须是 PDF 文件。");
  }
  if (input.rulebook.size === 0) {
    errors.push("规则书是空文件。");
  }
  if (input.rulebook.size > INGESTION_LIMITS.maxRulebookBytes) {
    errors.push("规则书不能超过 25 MB。");
  }
  if (input.assets.length === 0) {
    errors.push("请至少添加一份素材 PDF 或图片。");
  }
  if (input.assets.length > INGESTION_LIMITS.maxAssetFiles) {
    errors.push(`素材文件不能超过 ${INGESTION_LIMITS.maxAssetFiles} 个。`);
  }

  let totalAssetBytes = 0;
  for (const file of input.assets) {
    totalAssetBytes += file.size;
    const mimeType = normalizedMimeType(file);
    if (!PDF_TYPES.has(mimeType) && !IMAGE_TYPES.has(mimeType)) {
      errors.push(`${file.name} 不是支持的 PDF、JPG、PNG、WebP 或 GIF。`);
    }
    if (file.size === 0) {
      errors.push(`${file.name} 是空文件。`);
    }
    if (file.size > INGESTION_LIMITS.maxAssetFileBytes) {
      errors.push(`${file.name} 超过单文件 25 MB 限制。`);
    }
  }
  if (totalAssetBytes > INGESTION_LIMITS.maxAssetBytes) {
    errors.push("素材包总大小不能超过 100 MB。");
  }

  return errors;
}

export async function sha256Hex(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function assertPdfHeader(bytes: Uint8Array, name: string) {
  const header = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (header !== "%PDF-") {
    throw new Error(`${name} 不是可读取的 PDF：文件头无效。`);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("无法生成 PDF 页面预览。"));
    }, "image/webp", 0.82);
  });
}

export function validateImageAssets(files: Array<Pick<File, "name" | "size" | "type">>) {
  const errors: string[] = [];
  if (files.length > INGESTION_LIMITS.maxGenerationImages) {
    errors.push(`一次最多添加 ${INGESTION_LIMITS.maxGenerationImages} 张图片素材。`);
  }

  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
    const mimeType = normalizedMimeType(file);
    if (!IMAGE_TYPES.has(mimeType)) {
      errors.push(`${file.name} 不是支持的 JPG、PNG、WebP 或 GIF 图片。`);
    }
    if (file.size === 0) {
      errors.push(`${file.name} 是空文件。`);
    }
    if (file.size > INGESTION_LIMITS.maxAssetFileBytes) {
      errors.push(`${file.name} 超过单文件 25 MB 限制。`);
    }
  }
  if (totalBytes > INGESTION_LIMITS.maxAssetBytes) {
    errors.push("图片素材总大小不能超过 100 MB。");
  }
  return errors;
}

export async function prepareImageAsset(file: File, pageNumber: number) {
  const validationErrors = validateImageAssets([file]);
  if (validationErrors.length) throw new Error(validationErrors.join(" "));

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name} 无法解码，可能已损坏或格式不受支持。`);
  }

  try {
    const attempts = [
      { maxDimension: 1_200, quality: 0.82 },
      { maxDimension: 1_000, quality: 0.72 },
      { maxDimension: 800, quality: 0.62 },
      { maxDimension: 640, quality: 0.52 },
    ];
    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = globalThis.document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error(`${file.name} 无法创建图片处理画布。`);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value) resolve(value);
          else reject(new Error(`${file.name} 无法压缩。`));
        }, "image/webp", attempt.quality);
      });
      canvas.width = 0;
      canvas.height = 0;
      const content = await blobDataUrl(blob);
      if (content.length <= INGESTION_LIMITS.maxGenerationImageDataUrlLength) {
        return {
          name: file.name,
          content,
          pageNumber,
        };
      }
    }
  } finally {
    bitmap.close();
  }

  throw new Error(`${file.name} 压缩后仍超过素材大小限制，请选择更小的图片。`);
}

async function extractPdf(
  file: File,
  fileId: string,
): Promise<ExtractedPage[]> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  assertPdfHeader(bytes, file.name);

  let loadingTask: PDFDocumentLoadingTask | undefined;
  try {
    const { getDocument, GlobalWorkerOptions, OPS } = await import("pdfjs-dist");
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    loadingTask = getDocument({ data: new Uint8Array(buffer.slice(0)) });
    const pdfDocument = await loadingTask.promise;
    if (pdfDocument.numPages > INGESTION_LIMITS.maxPdfPages) {
      throw new Error(
        `${file.name} 有 ${pdfDocument.numPages} 页，超过 200 页限制。`,
      );
    }

    const pages: ExtractedPage[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      const operators = await page.getOperatorList();
      const hasEmbeddedImage = operators.fnArray.some((operation) =>
        [
          OPS.paintImageMaskXObject,
          OPS.paintImageMaskXObjectGroup,
          OPS.paintImageXObject,
          OPS.paintImageXObjectRepeat,
          OPS.paintImageMaskXObjectRepeat,
        ].includes(operation),
      );

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(1.5, 1200 / baseViewport.width);
      const viewport = page.getViewport({ scale });
      const canvas = globalThis.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const preview = await canvasToBlob(canvas);
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();

      pages.push({
        id: crypto.randomUUID(),
        kind: "pdf-page",
        sourceAnchor: { fileId, fileName: file.name, pageNumber },
        text,
        width: Math.round(baseViewport.width),
        height: Math.round(baseViewport.height),
        hasEmbeddedImage,
        preview,
      });
    }
    return pages;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(file.name)) throw error;
    throw new Error(`${file.name} 无法读取：${message}`);
  } finally {
    await loadingTask?.destroy();
  }
}

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("无法读取规则书页面图片。"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/**
 * Renders rulebook pages using the same PDF path as ingestion. Oversized page
 * previews are deliberately skipped: no Source Library image is claimed unless
 * it can be persisted by the project contract.
 */
export async function harvestRulebookPageImages(file: File) {
  if (normalizedMimeType(file) !== "application/pdf") return [];
  const pages = await extractPdf(file, crypto.randomUUID());
  const images = await Promise.all(
    pages.map(async (page) => ({
      name: `${file.name} · 第 ${page.sourceAnchor.pageNumber} 页`,
      content: await blobDataUrl(page.preview),
      pageNumber: page.sourceAnchor.pageNumber ?? 1,
    })),
  );
  return images
    .filter((image, index) => pages[index].hasEmbeddedImage)
    .filter((image) => image.content.length <= 100_000)
    .slice(0, 8);
}

async function extractImage(
  file: File,
  fileId: string,
): Promise<ExtractedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name} 无法解码，可能已损坏或格式不受支持。`);
  }

  const artifact: ExtractedImage = {
    id: crypto.randomUUID(),
    kind: "image",
    sourceAnchor: { fileId, fileName: file.name },
    width: bitmap.width,
    height: bitmap.height,
    image: file,
  };
  bitmap.close();
  return artifact;
}

async function ingestFile(
  file: File,
  role: SourceRole,
): Promise<IngestedSourceFile> {
  const id = crypto.randomUUID();
  const mimeType = normalizedMimeType(file);
  const buffer = await file.arrayBuffer();
  const sha256 = await sha256Hex(buffer);
  const artifacts = PDF_TYPES.has(mimeType)
    ? await extractPdf(file, id)
    : [await extractImage(file, id)];

  return {
    id,
    role,
    name: file.name,
    mimeType,
    size: file.size,
    sha256,
    original: file,
    artifacts,
  };
}

export async function ingestGameSourceBundle(
  input: IngestionInput,
  onProgress?: (progress: IngestionProgress) => void,
): Promise<GenerationRun> {
  const validationErrors = validateSourceBundle(input);
  if (validationErrors.length) {
    throw new Error(validationErrors.join(" "));
  }

  const now = new Date().toISOString();
  const files = [
    { file: input.rulebook, role: "rulebook" as const },
    ...input.assets.map((file) => ({ file, role: "asset" as const })),
  ];
  const run: GenerationRun = {
    id: crypto.randomUUID(),
    status: "ingesting",
    createdAt: now,
    updatedAt: now,
    privacy: "browser-local",
    retention: "until-player-deletes-browser-data",
    sources: [],
  };

  try {
    for (const [index, entry] of files.entries()) {
      onProgress?.({
        currentFile: entry.file.name,
        completedFiles: index,
        totalFiles: files.length,
      });
      run.sources.push(await ingestFile(entry.file, entry.role));
    }
    run.status = "ready-for-compilation";
    run.updatedAt = new Date().toISOString();
    return run;
  } catch (error) {
    run.status = "failed";
    run.updatedAt = new Date().toISOString();
    run.error = error instanceof Error ? error.message : String(error);
    return run;
  }
}
