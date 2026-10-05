import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type SceneHostProps = {
  className?: string;
};

function supportsWebGL2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

/**
 * Minimal Three.js host for G3D-02: WebGL2 renderer, orbit camera, and a
 * shadowed test cube. Game mapping arrives in G3D-03+.
 */
export function SceneHost({ className }: SceneHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    if (!supportsWebGL2()) {
      setUnsupported(true);
      return;
    }

    const scene = new Scene();
    scene.background = new Color(0x87b5d4);

    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(3.2, 2.6, 4.2);

    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0x87b5d4, 1);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.4, 0);

    const ambient = new AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    const sun = new DirectionalLight(0xfff2d6, 1.35);
    sun.position.set(4, 8, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 30;
    sun.shadow.camera.left = -6;
    sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -6;
    scene.add(sun);

    const groundGeometry = new PlaneGeometry(12, 12);
    const groundMaterial = new MeshStandardMaterial({
      color: 0xd7e6c8,
      roughness: 0.9,
      metalness: 0.05,
    });
    const ground = new Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const cubeGeometry = new BoxGeometry(1, 1, 1);
    const cubeMaterial = new MeshStandardMaterial({
      color: 0xc56b3a,
      roughness: 0.55,
      metalness: 0.1,
    });
    const cube = new Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(0, 0.5, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);

    let frameId = 0;
    let disposed = false;

    const resize = () => {
      if (disposed) {
        return;
      }
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
    };

    const onWindowResize = () => {
      resize();
    };

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            resize();
          })
        : null;
    observer?.observe(container);
    window.addEventListener("resize", onWindowResize);
    resize();

    const tick = () => {
      if (disposed) {
        return;
      }
      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onWindowResize);
      observer?.disconnect();
      controls.dispose();
      scene.remove(ambient, sun, ground, cube);
      groundGeometry.dispose();
      groundMaterial.dispose();
      cubeGeometry.dispose();
      cubeMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (unsupported) {
    return (
      <div
        aria-label="g3d-scene-host"
        className={className}
        data-testid="g3d-scene-host"
        role="img"
      >
        <p>此设备不支持 WebGL2，无法显示 3D 桌面。</p>
      </div>
    );
  }

  return (
    <div
      aria-label="g3d-scene-host"
      className={className}
      data-testid="g3d-scene-host"
      ref={containerRef}
      role="img"
      style={{ width: "100%", minHeight: 220, height: "32vh" }}
    />
  );
}
