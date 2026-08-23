"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { domains, portfolioNodes, type DomainId, type PortfolioNode } from "../../lib/portfolio";
import { getSceneQuality, isSoftwareRenderer } from "../../lib/scene-budget";
import type { TransitionPhase } from "../../lib/transition";
import { BodyScene, type PoseState } from "./BodyScene";
import { BrainGraph } from "./BrainGraph";
import { SceneFallback } from "./SceneFallback";

type SceneDirectorProps = {
  phase: TransitionPhase;
  selectedDomain: DomainId | null;
  reducedMotion: boolean;
  focusedNodeId: string | null;
};

function SceneDirector({ phase, selectedDomain, reducedMotion }: SceneDirectorProps) {
  const { camera } = useThree();
  const phaseStarted = useRef(0);
  const start = useRef(new THREE.Vector3(0, 1.35, 10));

  useEffect(() => {
    phaseStarted.current = performance.now();
    start.current.copy(camera.position);
  }, [camera, phase]);

  useFrame(() => {
    if (phase === "body") {
      camera.position.lerp(new THREE.Vector3(0, 1.35, 10), 0.06);
      camera.lookAt(0, 1.35, 0);
      return;
    }

    if (phase === "entering") {
      const elapsed = performance.now() - phaseStarted.current;
      const raw = reducedMotion ? 1 : Math.min(elapsed / 1500, 1);
      const eased = raw * raw * (3 - 2 * raw);
      const target = new THREE.Vector3(0, 1.75, 0.72);
      camera.position.copy(start.current.clone().lerp(target, eased));
      camera.lookAt(0, 1.75, 0);
      return;
    }

    if (selectedDomain) {
      const domain = domains.find((candidate) => candidate.id === selectedDomain);
      if (domain) {
        const position = new THREE.Vector3(
          Math.cos(domain.angle) * 8.2,
          4.4,
          Math.sin(domain.angle) * 8.2,
        );
        const focus = new THREE.Vector3(
          Math.cos(domain.angle) * 2.8,
          1.75,
          Math.sin(domain.angle) * 2.8,
        );
        camera.position.lerp(position, 0.055);
        camera.lookAt(focus);
        return;
      }
    }

    camera.position.lerp(new THREE.Vector3(0, 5.8, 14.8), 0.045);
    camera.lookAt(0, 1.3, 0);
  });

  return null;
}

type PortfolioCanvasProps = {
  phase: TransitionPhase;
  pose: PoseState;
  selectedDomain: DomainId | null;
  reducedMotion: boolean;
  focusedNodeId: string | null;
  selectedNodeId: string | null;
  onNodeSelect: (node: PortfolioNode) => void;
  onEnter: () => void;
};

export function PortfolioCanvas({
  phase,
  pose,
  selectedDomain,
  reducedMotion,
  focusedNodeId,
  selectedNodeId,
  onNodeSelect,
  onEnter,
}: PortfolioCanvasProps) {
  const [lowPower, setLowPower] = useState(
    () => typeof navigator !== "undefined" && (navigator.hardwareConcurrency || 8) <= 4,
  );
  const [mobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches,
  );

  const quality = useMemo(
    () => getSceneQuality({ reducedMotion, lowPower }),
    [lowPower, reducedMotion],
  );

  return (
    <div className="scene-canvas-wrap">
      <Canvas
        dpr={quality.dpr}
        camera={{ position: [0, 1.35, 10], fov: mobile ? 52 : 43, near: 0.05, far: 80 }}
        fallback={<SceneFallback />}
        gl={{ alpha: true, antialias: !lowPower, powerPreference: lowPower ? "low-power" : "high-performance" }}
        onCreated={({ gl }) => {
          if (isSoftwareRenderer(gl.getContext())) setLowPower(true);
        }}
      >
        <color attach="background" args={["#f4f1e8"]} />
        <fog attach="fog" args={["#f4f1e8", 9, 24]} />
        <ambientLight intensity={1.05} color="#ffffff" />
        <directionalLight position={[4, 8, 7]} intensity={2} color="#fff4cf" />
        <pointLight position={[-5, 1, 2]} intensity={8} distance={12} color="#3d7c6c" />
        <Suspense fallback={null}>
          <BodyScene
            visible={phase !== "graph"}
            pose={pose}
            quality={quality}
            onEnter={onEnter}
          />
          <BrainGraph
            phase={phase}
            nodes={portfolioNodes}
            focusedNodeId={focusedNodeId}
            selectedNodeId={selectedNodeId}
            quality={quality}
            onSelect={onNodeSelect}
          />
          <SceneDirector
            phase={phase}
            selectedDomain={selectedDomain}
            reducedMotion={reducedMotion}
          />
          {phase === "graph" && !mobile ? (
            <OrbitControls
              enablePan={false}
              enableZoom
              maxDistance={16}
              minDistance={5}
              target={[0, 1.6, 0]}
              rotateSpeed={0.35}
              zoomSpeed={0.5}
            />
          ) : null}
        </Suspense>
      </Canvas>

    </div>
  );
}
