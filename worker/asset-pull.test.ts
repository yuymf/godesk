import { describe, expect, it } from "vitest";
import { isCc0ModelCandidate, queryFromPrompt } from "./asset-pull";
import { isGlb, readZip, toGlb } from "./gltf-zip-to-glb";
import type { AssetServerAsset } from "../src/creator/asset-search/types";

async function deflateRaw(data: Uint8Array) {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Minimal zip writer (stored + deflate) — CRC left 0; our reader does not check it. */
async function makeZip(files: Record<string, Uint8Array>) {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  let index = 0;
  for (const [name, raw] of Object.entries(files)) {
    const method = index++ % 2 === 0 ? 8 : 0;
    const data = method === 8 ? await deflateRaw(raw) : raw;
    const nameBytes = enc.encode(name);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, method, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((sum, c) => sum + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22);
  let cursor = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

const CC0_BARREL: AssetServerAsset = {
  id: "polyhaven:Barrel_01",
  provider: "polyhaven",
  nativeId: "Barrel_01",
  title: "Barrel 01",
  type: "model",
  tags: [],
  url: "https://polyhaven.com/a/Barrel_01",
  license: { name: "CC0", attributionRequired: false },
  price: { free: true },
  formats: ["gltf"],
  downloadable: true,
};

describe("asset pull from one sentence", () => {
  it("extracts a search query from zh / en sentences", () => {
    expect(queryFromPrompt("给汐屿的桌边加一个 CC0 木桶")).toBe("barrel");
    expect(queryFromPrompt("Add a wooden crate to my room")).toBe("wooden crate");
    expect(queryFromPrompt("please pull an anchor model")).toBe("anchor");
  });

  it("accepts only downloadable CC0 glTF/GLB models", () => {
    expect(isCc0ModelCandidate(CC0_BARREL)).toBe(true);
    expect(isCc0ModelCandidate({ ...CC0_BARREL, license: { name: "Royalty Free" }, formats: ["glb"] })).toBe(false);
    expect(isCc0ModelCandidate({ ...CC0_BARREL, formats: ["blend"] })).toBe(false);
    expect(isCc0ModelCandidate({ ...CC0_BARREL, downloadable: false })).toBe(false);
  });
});

describe("gltf zip → glb", () => {
  it("packs gltf + bin + textures from a zip into one GLB", async () => {
    const bin = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 7]);
    const gltf = {
      asset: { version: "2.0" },
      buffers: [{ uri: "Barrel_01.bin", byteLength: 10 }],
      bufferViews: [{ buffer: 0, byteOffset: 2, byteLength: 6 }],
      images: [{ uri: "textures/Barrel_01_diff_1k.jpg" }],
    };
    const zip = await makeZip({
      "Barrel_01_1k.gltf": new TextEncoder().encode(JSON.stringify(gltf)),
      "Barrel_01.bin": bin,
      "textures/Barrel_01_diff_1k.jpg": jpg,
    });
    expect((await readZip(zip)).size).toBe(3);
    const glb = await toGlb(zip);
    expect(isGlb(glb)).toBe(true);
    const view = new DataView(glb.buffer, glb.byteOffset);
    expect(view.getUint32(8, true)).toBe(glb.byteLength);
    const jsonLength = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)));
    expect(json.buffers).toEqual([{ byteLength: 12 + 8 }]);
    expect(json.images[0]).toMatchObject({ bufferView: 1, mimeType: "image/jpeg" });
    expect(json.images[0].uri).toBeUndefined();
    const binStart = 20 + jsonLength + 8;
    const imageView = json.bufferViews[1];
    expect([...glb.subarray(binStart + imageView.byteOffset, binStart + imageView.byteOffset + 5)]).toEqual([...jpg]);
    expect([...glb.subarray(binStart + 2, binStart + 8)]).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it("passes a GLB through unchanged", async () => {
    const glb = new Uint8Array(12);
    new DataView(glb.buffer).setUint32(0, 0x46546c67, true);
    expect(await toGlb(glb)).toBe(glb);
  });
});
