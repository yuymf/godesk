import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import type { GameState, PlayerId, Ship, ShipId } from "../domain/game";

const laneZ: Record<ShipId, number> = { tea: -2.25, silk: 0, spice: 2.25 };

function positionToX(position: number) {
  return -4.65 + Math.min(position, 13.25) * 0.68;
}

function WorkerToken({ color, index }: { color: string; index: number }) {
  return (
    <mesh position={[-0.55 + index * 0.55, 0.55, 0]} castShadow>
      <cylinderGeometry args={[0.16, 0.2, 0.38, 16]} />
      <meshStandardMaterial color={color} roughness={0.65} />
    </mesh>
  );
}

function ShipMesh({
  ship,
  workers,
  interactive,
  onSelect,
}: {
  ship: Ship;
  workers: string[];
  interactive: boolean;
  onSelect: (shipId: ShipId) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (interactive) onSelect(ship.id);
  };

  return (
    <group
      position={[positionToX(ship.position), 0.34, laneZ[ship.id]]}
      onClick={handleClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (interactive) setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh castShadow receiveShadow scale={hovered ? 1.06 : 1}>
        <boxGeometry args={[1.65, 0.34, 1.05]} />
        <meshStandardMaterial
          color={ship.color}
          emissive={hovered ? ship.color : "#000000"}
          emissiveIntensity={hovered ? 0.2 : 0}
          roughness={0.7}
        />
      </mesh>
      <mesh position={[-0.72, 0.14, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.48, 0.34, 1.05]} />
        <meshStandardMaterial color={ship.color} roughness={0.7} />
      </mesh>
      {workers.map((color, index) => (
        <WorkerToken key={`${color}-${index}`} color={color} index={index} />
      ))}
    </group>
  );
}

function Board({
  state,
  onSelectShip,
}: {
  state: GameState;
  onSelectShip: (shipId: ShipId) => void;
}) {
  const playerColors = Object.fromEntries(
    state.players.map((player) => [player.id, player.color]),
  ) as Record<PlayerId, string>;
  const humanTurn = state.phase === "placement" && state.activePlayer === "you";

  return (
    <>
      <color attach="background" args={["#c7e1dc"]} />
      <ambientLight intensity={1.9} />
      <directionalLight
        position={[-4, 9, 7]}
        intensity={2.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12.6, 7.7]} />
        <meshStandardMaterial color="#2f7773" roughness={0.9} />
      </mesh>
      {["tea", "silk", "spice"].map((shipId) => (
        <group key={shipId}>
          {Array.from({ length: 14 }, (_, index) => (
            <mesh
              key={index}
              position={[positionToX(index), 0.035, laneZ[shipId as ShipId]]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[0.17, 0.22, 20]} />
              <meshBasicMaterial color={index === 13 ? "#f7c65d" : "#8fc0b7"} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[5.35, 0.08, 0]} receiveShadow>
        <boxGeometry args={[0.8, 0.16, 7.7]} />
        <meshStandardMaterial color="#e9d4ac" roughness={0.95} />
      </mesh>
      <mesh position={[4.45, 0.08, 0]} receiveShadow>
        <boxGeometry args={[0.14, 0.18, 7.7]} />
        <meshStandardMaterial color="#ed8b65" />
      </mesh>
      {state.ships.map((ship) => (
        <ShipMesh
          key={ship.id}
          ship={ship}
          workers={state.placements
            .filter((placement) => placement.targetId === ship.id)
            .map((placement) => playerColors[placement.playerId])}
          interactive={humanTurn}
          onSelect={onSelectShip}
        />
      ))}
    </>
  );
}

export function HarborScene({
  state,
  onSelectShip,
}: {
  state: GameState;
  onSelectShip: (shipId: ShipId) => void;
}) {
  const compact =
    typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches;

  return (
    <Canvas
      shadows
      orthographic
      camera={{
        position: [0, 10.5, 10.5],
        zoom: compact ? 31 : 72,
        near: 0.1,
        far: 100,
      }}
      dpr={[1, 1.5]}
    >
      <Board state={state} onSelectShip={onSelectShip} />
    </Canvas>
  );
}
