import { describe, expect, it } from "vitest";
import {
  INGESTION_LIMITS,
  extractRulebookText,
  harvestRulebookPageImages,
  normalizedMimeType,
  validateImageAssets,
  validateRulebookFile,
} from "./ingestion";

function testFile(
  name: string,
  type: string,
  size = 12,
): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("home rulebook extraction", () => {
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
    expect(normalizedMimeType({ name: "notes.txt", type: "" })).toBe(
      "text/plain",
    );
  });

  it("accepts PDF and text rulebooks for the creator-first flow", () => {
    expect(validateRulebookFile(testFile("rules.pdf", "application/pdf"))).toBe("");
    expect(validateRulebookFile(testFile("rules.txt", "text/plain"))).toBe("");
    expect(validateRulebookFile(testFile("rules.md", "text/markdown"))).toBe("");
    expect(validateRulebookFile(testFile("rules.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toContain("PDF、TXT 或 Markdown");
    expect(validateRulebookFile(testFile("empty.txt", "text/plain", 0))).toBe("规则文档是空文件。");
  });

  it("extracts TXT and Markdown as the home path does", async () => {
    await expect(
      extractRulebookText(new File(["三个人在别墅里讨论谁是凶手。"], "idea.txt", { type: "text/plain" })),
    ).resolves.toBe("三个人在别墅里讨论谁是凶手。");
    await expect(
      extractRulebookText(new File(["# 港口竞速\n派遣伙计。"], "rules.md", { type: "text/markdown" })),
    ).resolves.toBe("# 港口竞速\n派遣伙计。");
  });

  it("rejects empty or unsupported files before extraction", async () => {
    await expect(extractRulebookText(testFile("empty.txt", "text/plain", 0)))
      .rejects.toThrow("规则文档是空文件。");
    await expect(
      extractRulebookText(testFile("rules.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
    ).rejects.toThrow("PDF、TXT 或 Markdown");
  });

  it("does not harvest page images from text rulebooks", async () => {
    await expect(
      harvestRulebookPageImages(new File(["# 规则"], "rules.md", { type: "text/markdown" })),
    ).resolves.toEqual([]);
    await expect(
      harvestRulebookPageImages(new File(["plain idea"], "notes.txt", { type: "text/plain" })),
    ).resolves.toEqual([]);
  });
});

describe("home visual assets", () => {
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
