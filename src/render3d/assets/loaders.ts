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

const DEFAULT_BASIS_PATH = "/basis/";

/**
 * 创建加载器集合。KTX2 的 Basis 转码 worker 仅在首次 detectSupport 时拉取。
 */
export function createAssetLoaders(
  renderer: WebGLRenderer,
  basisPath: string = DEFAULT_BASIS_PATH,
): AssetLoaders {
  const gltf = new GLTFLoader();
  gltf.setMeshoptDecoder(MeshoptDecoder);

  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath(basisPath);
  ktx2.detectSupport(renderer);
  gltf.setKTX2Loader(ktx2);

  return { gltf, ktx2 };
}

export function disposeAssetLoaders(loaders: AssetLoaders): void {
  loaders.ktx2.dispose();
}

export { GLTFLoader, KTX2Loader, MeshoptDecoder };
