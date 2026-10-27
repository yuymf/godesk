/**
 * GoDesk ② CC0 GLB chain: Poly Haven serves models as a .gltf + .bin + textures zip.
 * Rooms load a single self-contained GLB, so the Worker unzips (stored / deflate via
 * DecompressionStream) and packs gltf + buffers + images into one GLB binary chunk.
 */

type ZipEntries = Map<string, Uint8Array>;

const GLB_MAGIC = 0x46546c67;

function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export function isGlb(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true) === GLB_MAGIC;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(bytes: Uint8Array): Promise<ZipEntries> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip_invalid");
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ZipEntries = new Map();
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("zip_invalid");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/")) continue;
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(start, start + compressedSize);
    if (method === 0) entries.set(name, data.slice());
    else if (method === 8) entries.set(name, await inflateRaw(data));
    else throw new Error("zip_unsupported_method");
  }
  return entries;
}

type GltfJson = {
  buffers?: Array<{ uri?: string; byteLength: number }>;
  bufferViews?: Array<{ buffer: number; byteOffset?: number; byteLength: number }>;
  images?: Array<{ uri?: string; mimeType?: string; bufferView?: number }>;
  [key: string]: unknown;
};

function mimeForImage(path: string): string {
  return /\.png$/i.test(path) ? "image/png" : /\.webp$/i.test(path) ? "image/webp" : "image/jpeg";
}

function resolveRelative(base: string, uri: string): string {
  const decoded = decodeURIComponent(uri);
  const dir = base.includes("/") ? base.slice(0, base.lastIndexOf("/") + 1) : "";
  const parts: string[] = [];
  for (const part of `${dir}${decoded}`.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

function pad4(length: number) {
  return (4 - (length % 4)) % 4;
}

/** Pack a .gltf (with sibling files in `entries`) into one GLB. */
function packGltfToGlb(gltfPath: string, entries: ZipEntries): Uint8Array {
  const source = entries.get(gltfPath);
  if (!source) throw new Error("gltf_missing");
  const json = JSON.parse(new TextDecoder().decode(source)) as GltfJson;
  const lookup = (uri: string) => {
    const hit = entries.get(resolveRelative(gltfPath, uri));
    if (!hit) throw new Error(`gltf_missing_file:${uri}`);
    return hit;
  };
  const chunks: Uint8Array[] = [];
  let length = 0;
  const append = (data: Uint8Array) => {
    const start = length;
    chunks.push(data);
    length += data.byteLength;
    const pad = pad4(data.byteLength);
    if (pad) {
      chunks.push(new Uint8Array(pad));
      length += pad;
    }
    return start;
  };
  const bufferStarts = (json.buffers ?? []).map((buffer) => {
    if (!buffer.uri) throw new Error("gltf_buffer_without_uri");
    if (buffer.uri.startsWith("data:")) throw new Error("gltf_data_uri_unsupported");
    return append(lookup(buffer.uri).subarray(0, buffer.byteLength));
  });
  const bufferViews = (json.bufferViews ?? []).map((view) => ({
    ...view,
    buffer: 0,
    byteOffset: (view.byteOffset ?? 0) + (bufferStarts[view.buffer] ?? 0),
  }));
  for (const image of json.images ?? []) {
    if (!image.uri || image.uri.startsWith("data:")) continue;
    const data = lookup(image.uri);
    const byteOffset = append(data);
    bufferViews.push({ buffer: 0, byteOffset, byteLength: data.byteLength });
    image.mimeType = image.mimeType ?? mimeForImage(image.uri);
    image.bufferView = bufferViews.length - 1;
    delete image.uri;
  }
  json.bufferViews = bufferViews;
  json.buffers = [{ byteLength: length }];
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = pad4(jsonBytes.byteLength);
  const jsonChunkLength = jsonBytes.byteLength + jsonPad;
  const total = 12 + 8 + jsonChunkLength + 8 + length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunkLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  out.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonChunkLength);
  let cursor = 20 + jsonChunkLength;
  view.setUint32(cursor, length, true);
  view.setUint32(cursor + 4, 0x004e4942, true);
  cursor += 8;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return out;
}

/** Zip of a glTF → GLB; a raw GLB passes through. */
export async function toGlb(bytes: Uint8Array): Promise<Uint8Array> {
  if (isGlb(bytes)) return bytes;
  if (!isZip(bytes)) throw new Error("asset_not_glb_or_zip");
  const entries = await readZip(bytes);
  const glbEntry = [...entries.keys()].find((name) => /\.glb$/i.test(name));
  if (glbEntry) return entries.get(glbEntry)!;
  const gltfEntry = [...entries.keys()].find((name) => /\.gltf$/i.test(name));
  if (!gltfEntry) throw new Error("zip_has_no_gltf");
  return packGltfToGlb(gltfEntry, entries);
}
