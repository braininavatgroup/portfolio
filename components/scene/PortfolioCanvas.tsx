"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { frameSpatialNodes, type Point3 } from "../../lib/graph-camera";
import { domains, type DomainId } from "../../lib/portfolio";
import { getSceneQuality, isSoftwareRenderer } from "../../lib/scene-budget";
import type { SpatialGraphNode } from "../../lib/spatial-graph";
import type { TransitionPhase } from "../../lib/transition";
import { BodyScene, type PoseState } from "./BodyScene";
import { BrainGraph } from "./BrainGraph";
import { SceneFallback } from "./SceneFallback";

type SceneDirectorProps = {
  phase: TransitionPhase;
  selectedDomain: DomainId | null;
  reducedMotion: boolean;
  mobile: boolean;
  nodes: readonly SpatialGraphNode[];
};

const graphWorldOffset: Point3 = [0, 1.75, 0];

function SceneDirector({
  phase,
  selectedDomain,
  reducedMotion,
  mobile,
  nodes,
}: SceneDirectorProps) {
  const { camera, size } = useThree();
  const phaseStarted = useRef(0);
  const start = useRef(new THREE.Vector3(0, 1.35, 10));
  const guiding = useRef(true);
  const verticalFovDegrees =
    camera instanceof THREE.PerspectiveCamera
      ? camera.fov
      : mobile
        ? 52
        : 43;
  const selectedDomainRecord = domains.find(
    (candidate) => candidate.id === selectedDomain,
  );
  const framedNodes = useMemo(() => {
    if (!selectedDomain) return nodes;

    const domainNodes = nodes.filter(
      ({ groupId }) => groupId === selectedDomain,
    );
    return domainNodes.length > 0 ? domainNodes : nodes;
  }, [nodes, selectedDomain]);
  const graphFrame = useMemo(
    () =>
      frameSpatialNodes({
        nodes: framedNodes,
        aspect: size.width / Math.max(size.height, 1),
        verticalFovDegrees,
        nodeBoundRadius: 0.6,
        margin: selectedDomain ? 1.22 : 1.16,
        worldOffset: graphWorldOffset,
        viewDirection: selectedDomainRecord
          ? [
              Math.cos(selectedDomainRecord.angle),
              0.42,
              Math.sin(selectedDomainRecord.angle),
            ]
          : undefined,
      }),
    [
      framedNodes,
      selectedDomain,
      selectedDomainRecord,
      size.height,
      size.width,
      verticalFovDegrees,
    ],
  );
  const destination = useMemo(() => {
    if (phase === "body") {
      return {
        position: [0, 1.35, 10] as Point3,
        target: [0, 1.35, 0] as Point3,
      };
    }
    if (phase === "entering") {
      return {
        position: [0, 1.75, 0.72] as Point3,
        target: [0, 1.75, 0] as Point3,
      };
    }
    return graphFrame;
  }, [graphFrame, phase]);
  const destinationPosition = useMemo(
    () => new THREE.Vector3(...destination.position),
    [destination.position],
  );
  const destinationTarget = useMemo(
    () => new THREE.Vector3(...destination.target),
    [destination.target],
  );

  useEffect(() => {
    phaseStarted.current = performance.now();
    start.current.copy(camera.position);
    guiding.current = true;
  }, [camera, destinationPosition, destinationTarget]);

  useFrame(() => {
    if (!guiding.current) return;

    if (phase === "entering") {
      const elapsed = performance.now() - phaseStarted.current;
      const raw = reducedMotion ? 1 : Math.min(elapsed / 1500, 1);
      const eased = raw * raw * (3 - 2 * raw);
      camera.position.copy(
        start.current.clone().lerp(destinationPosition, eased),
      );
      camera.lookAt(destinationTarget);
      if (raw === 1) guiding.current = false;
      return;
    }

    camera.position.lerp(
      destinationPosition,
      reducedMotion ? 1 : phase === "body" ? 0.06 : 0.055,
    );
    camera.lookAt(destinationTarget);
    if (camera.position.distanceTo(destinationPosition) < 0.015) {
      camera.position.copy(destinationPosition);
      camera.lookAt(destinationTarget);
      guiding.current = false;
    }
  });

  if (phase !== "graph" || mobile) return null;

  return (
    <OrbitControls
      enablePan={false}
      enableZoom
      maxDistance={graphFrame.distance * 1.3}
      maxPolarAngle={Math.PI / 2 - 0.08}
      minDistance={Math.max(graphFrame.distance * 0.36, 4)}
      minPolarAngle={Math.PI * 0.14}
      target={graphFrame.target}
      rotateSpeed={0.35}
      zoomSpeed={0.5}
    />
  );
}

type PortfolioCanvasProps = {
  phase: TransitionPhase;
  nodes: readonly SpatialGraphNode[];
  pose: PoseState;
  selectedDomain: DomainId | null;
  reducedMotion: boolean;
  focusedNodeId: string | null;
  selectedNodeId: string | null;
  onNodeSelect: (node: SpatialGraphNode) => void;
  onEnter: () => void;
};

export function PortfolioCanvas({
  phase,
  nodes,
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
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const updateMobile = () => setMobile(media.matches);
    updateMobile();
    media.addEventListener("change", updateMobile);
    return () => media.removeEventListener("change", updateMobile);
  }, []);

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
        <fog attach="fog" args={["#f4f1e8", 11, 30]} />
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
            nodes={nodes}
            focusedNodeId={focusedNodeId}
            selectedNodeId={selectedNodeId}
            quality={quality}
            onSelect={onNodeSelect}
          />
          <SceneDirector
            phase={phase}
            selectedDomain={selectedDomain}
            reducedMotion={reducedMotion}
            mobile={mobile}
            nodes={nodes}
          />
        </Suspense>
      </Canvas>

    </div>
  );
}
