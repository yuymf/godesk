/**
 * CI stand-in for the 3d-asset-server sidecar (http://127.0.0.1:8787): one CC0 Poly Haven–shaped
 * model whose download is a .gltf + .bin zip (stored), same as the real Poly Haven path.
 */
import { createServer, type Server } from "node:http";

function cubeGltfFiles() {
  const p = [-0.5, 0.5];
  const positions: number[] = [];
  for (const x of p) for (const y of p) for (const z of p) positions.push(x, y + 0.5, z);
  const indices = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3];
  const pos = Buffer.from(new Float32Array(positions).buffer);
  const idx = Buffer.from(new Uint16Array(indices).buffer);
  const bin = Buffer.concat([pos, idx]);
  const gltf = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.55, 0.33, 0.16, 1], roughnessFactor: 0.8 } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    buffers: [{ uri: "Mock_Crate.bin", byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: pos.length },
      { buffer: 0, byteOffset: pos.length, byteLength: idx.length },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: "VEC3", min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] },
      { bufferView: 1, componentType: 5123, count: indices.length, type: "SCALAR" },
    ],
  };
  return { "Mock_Crate_1k.gltf": Buffer.from(JSON.stringify(gltf)), "Mock_Crate.bin": bin };
}

function storedZip(files: Record<string, Buffer>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, eocd]);
}

export const MOCK_CC0_ASSET = {
  id: "polyhaven:Mock_Crate",
  provider: "polyhaven",
  nativeId: "Mock_Crate",
  title: "Mock Crate (e2e)",
  type: "model",
  tags: ["barrel", "crate"],
  url: "https://polyhaven.com/models",
  author: "GoDesk e2e",
  license: { name: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/", commercialUse: true, attributionRequired: false },
  price: { free: true },
  downloadable: true,
  formats: ["gltf"],
  resolutions: ["1k"],
  score: 1,
};

export async function startMockAssetServer(port = 8787): Promise<Server> {
  const zip = storedZip(cubeGltfFiles());
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
    } else if (url.pathname === "/v1/search") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({
        query: url.searchParams.get("q") ?? "",
        results: [MOCK_CC0_ASSET],
        providers: [{ provider: "polyhaven", name: "Poly Haven", status: "ok", count: 1, tookMs: 1 }],
      }));
    } else if (url.pathname.endsWith("/download")) {
      res.writeHead(200, {
        "content-type": "application/zip",
        "content-length": String(zip.length),
        "content-disposition": 'attachment; filename="Mock_Crate_1k.zip"',
      }).end(zip);
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  return server;
}
