/**
 * 强制 Vite 产出独立的 render3d-assets chunk（供 size-limit 度量）。
 * 业务侧通过 createAssetLoaders / 动态 import 使用。
 * Basis 转码器由 KTX2Loader 以 `new URL(..., import.meta.url)` 懒加载为独立资产，
 * 不计入本 chunk 的 60 KB gzip 预算（SPEC §5.5.3 Basis ≤ 261 KB）。
 */
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  createAssetLoaders,
  disposeAssetLoaders,
} from "./loaders";

export {
  GLTFLoader,
  KTX2Loader,
  MeshoptDecoder,
  createAssetLoaders,
  disposeAssetLoaders,
};

// 防止入口导出被 DCE 掏空
export const __g3dAssetChunkVersion = "g3d-11";
export function __g3dTouchLoaders() {
  return { GLTFLoader, KTX2Loader, MeshoptDecoder, createAssetLoaders, disposeAssetLoaders };
}
