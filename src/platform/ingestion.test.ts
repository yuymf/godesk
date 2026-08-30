import { describe, expect, it } from "vitest";
import {
  INGESTION_LIMITS,
  normalizedMimeType,
  validateImageAssets,
  sha256Hex,
  validateRulebookFile,
  validateSourceBundle,
} from "./ingestion";

function testFile(
  name: string,
  type: string,
  size = 12,
): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("source bundle validation", () => {
  it("accepts a PDF rulebook and supported image assets", () => {
    expect(
      validateSourceBundle({
        rulebook: testFile("rules.pdf", "application/pdf"),
        assets: [
          testFile("board.png", "image/png"),
          testFile("cards.webp", "image/webp"),
        ],
      }),
    ).toEqual([]);
  });

  it("normalizes types from file extensions when browsers omit MIME", () => {
    expect(normalizedMimeType({ name: "RULES.PDF", type: "" })).toBe(
      "application/pdf",
    );
    expect(normalizedMimeType({ name: "token.JPEG", type: "" })).toBe(
      "image/jpeg",
    );
    expect(normalizedMimeType({ name: "rules.md", type: "" })).toBe(
      "text/markdown",
    );
  });

  it("accepts PDF and text rulebooks for the creator-first flow", () => {
    expect(validateRulebookFile(testFile("rules.pdf", "application/pdf"))).toBe("");
    expect(validateRulebookFile(testFile("rules.txt", "text/plain"))).toBe("");
    expect(validateRulebookFile(testFile("rules.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toContain("PDF、TXT 或 Markdown");
  });

  it("reports unsupported, empty, oversized, and missing inputs together", () => {
    const errors = validateSourceBundle({
      rulebook: testFile("rules.txt", "text/plain", 0),
      assets: [
        testFile(
          "huge.bmp",
          "image/bmp",
          INGESTION_LIMITS.maxAssetFileBytes + 1,
        ),
      ],
    });

    expect(errors).toContain("规则书必须是 PDF 文件。");
    expect(errors).toContain("规则书是空文件。");
    expect(errors).toContain("huge.bmp 不是支持的 PDF、JPG、PNG、WebP 或 GIF。");
    expect(errors).toContain("huge.bmp 超过单文件 25 MB 限制。");
  });

  it("validates standalone visual assets for prompt generation", () => {
    expect(validateImageAssets([
      testFile("board.png", "image/png"),
      testFile("cards.webp", "image/webp"),
    ])).toEqual([]);
    expect(validateImageAssets([
      testFile("rules.txt", "text/plain"),
      testFile("empty.png", "image/png", 0),
    ]).join(" ")).toContain("rules.txt 不是支持的 JPG、PNG、WebP 或 GIF 图片");
    expect(validateImageAssets([
      testFile("empty.png", "image/png", 0),
    ])).toContain("empty.png 是空文件。");
  });

  it("limits the number of generation images", () => {
    const files = Array.from({ length: INGESTION_LIMITS.maxGenerationImages + 1 }, (_, index) =>
      testFile(`image-${index}.png`, "image/png"));
    expect(validateImageAssets(files)).toContain("一次最多添加 8 张图片素材。");
  });
});

describe("source hashing", () => {
  it("produces the known SHA-256 for abc", async () => {
    const bytes = new TextEncoder().encode("abc");
    await expect(sha256Hex(bytes.buffer)).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
