/**
 * render3d-assets chunk 入口：GLTF / KTX2 / meshopt 加载器。
 * Basis 转码器经 KTX2Loader.detectSupport 懒加载，不打进本 chunk。
 */
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { WebGLRenderer } from "three";

export type AssetLoaders = {
  gltf: GLTFLoader;
  ktx2: KTX2Loader;
};

/**
 * 默认空路径：three r186 的 KTX2Loader 用 `new URL("../libs/basis/…", import.meta.url)`
 * 引用转码器，Vite 会把它打包为带 hash 的独立文件（dist/assets/basis_transcoder-*.{js,wasm}）。
 * G3D-07 之前这里写死 "/basis/"，但 dist 并不提供该目录，第一次真正加载 KTX2 时才暴露。
 */
const DEFAULT_BASIS_PATH = "";

/**
 * 创建加载器集合。KTX2 的 Basis 转码器在第一次加载贴图时才拉取。
 *
 * launch-gate-block：同一 renderer 的调用方（PBR 流式贴图 + 海面贴图）共享一份引用计数的加载器，
 * 否则两个 KTX2Loader 各自拉一遍 basis_transcoder.{js,wasm}（首局多 2 个请求）并各起一组 worker。
 * 每次 create 必须配一次 dispose；最后一个引用释放时才真正 dispose KTX2Loader。
 */
type SharedEntry = { loaders: AssetLoaders; refs: number };
const shared = new WeakMap<WebGLRenderer, Map<string, SharedEntry>>();
const owners = new WeakMap<AssetLoaders, { renderer: WebGLRenderer; key: string }>();

export function createAssetLoaders(
  renderer: WebGLRenderer,
  basisPath: string = DEFAULT_BASIS_PATH,
): AssetLoaders {
  let byPath = shared.get(renderer);
  if (!byPath) {
    byPath = new Map();
    shared.set(renderer, byPath);
  }
  const existing = byPath.get(basisPath);
  if (existing) {
    existing.refs += 1;
    return existing.loaders;
  }

  const gltf = new GLTFLoader();
  gltf.setMeshoptDecoder(MeshoptDecoder);

  const ktx2 = new KTX2Loader();
  if (basisPath) ktx2.setTranscoderPath(basisPath);
  ktx2.detectSupport(renderer);
  gltf.setKTX2Loader(ktx2);

  const loaders = { gltf, ktx2 };
  byPath.set(basisPath, { loaders, refs: 1 });
  owners.set(loaders, { renderer, key: basisPath });
  return loaders;
}

export function disposeAssetLoaders(loaders: AssetLoaders): void {
  const owner = owners.get(loaders);
  const entry = owner ? shared.get(owner.renderer)?.get(owner.key) : undefined;
  if (owner && entry && entry.loaders === loaders) {
    entry.refs -= 1;
    if (entry.refs > 0) return;
    shared.get(owner.renderer)?.delete(owner.key);
    owners.delete(loaders);
  }
  loaders.ktx2.dispose();
}

export { GLTFLoader, KTX2Loader, MeshoptDecoder };
