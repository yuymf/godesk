import { describe, expect, it } from "vitest";
import {
  INGESTION_LIMITS,
  normalizedMimeType,
  sha256Hex,
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
});

describe("source hashing", () => {
  it("produces the known SHA-256 for abc", async () => {
    const bytes = new TextEncoder().encode("abc");
    await expect(sha256Hex(bytes.buffer)).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
