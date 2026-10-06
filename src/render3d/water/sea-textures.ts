/**
 * G3D-08 · load G3D-19 sea-normal / foam-noise KTX2 via G3D-07 asset loaders.
 */
import { RepeatWrapping, type Texture, type WebGLRenderer } from "three";

const SEA_URLS = import.meta.glob("../../../assets/textures/ktx2/{sea-normal,foam-noise}.ktx2", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function urlFor(name: "sea-normal" | "foam-noise"): string {
  const hit = Object.entries(SEA_URLS).find(([path]) => path.endsWith(`/${name}.ktx2`));
  if (!hit) throw new Error(`missing KTX2 ${name}`);
  return hit[1]!;
}

export type SeaTextures = { normal: Texture; foam: Texture; dispose(): void };

export async function loadSeaTextures(renderer: WebGLRenderer): Promise<SeaTextures> {
  const { createAssetLoaders, disposeAssetLoaders } = await import("../assets/loaders");
  const loaders = createAssetLoaders(renderer);
  const [normal, foam] = await Promise.all([
    loaders.ktx2.loadAsync(urlFor("sea-normal")),
    loaders.ktx2.loadAsync(urlFor("foam-noise")),
  ]);
  for (const tex of [normal, foam]) {
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.needsUpdate = true;
  }
  return {
    normal,
    foam,
    dispose() {
      normal.dispose();
      foam.dispose();
      disposeAssetLoaders(loaders);
    },
  };
}
