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
 */
export function createAssetLoaders(
  renderer: WebGLRenderer,
  basisPath: string = DEFAULT_BASIS_PATH,
): AssetLoaders {
  const gltf = new GLTFLoader();
  gltf.setMeshoptDecoder(MeshoptDecoder);

  const ktx2 = new KTX2Loader();
  if (basisPath) ktx2.setTranscoderPath(basisPath);
  ktx2.detectSupport(renderer);
  gltf.setKTX2Loader(ktx2);

  return { gltf, ktx2 };
}

export function disposeAssetLoaders(loaders: AssetLoaders): void {
  loaders.ktx2.dispose();
}

export { GLTFLoader, KTX2Loader, MeshoptDecoder };
