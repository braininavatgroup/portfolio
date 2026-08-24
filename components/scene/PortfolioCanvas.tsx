"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import * as THREE from "three";
import { frameSpatialNodes, type Point3 } from "../../lib/graph-camera";
import { domains, type DomainId } from "../../lib/portfolio";
import { brainWorldOrigin } from "../../lib/scene-origin";
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

const graphWorldOffset: Point3 = brainWorldOrigin;

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
  const startUp = useRef(new THREE.Vector3(0, 1, 0));
  const guiding = useRef(true);
  const directGraphEntry = useRef(phase === "graph");
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
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

    const focusedNodes = mobile
      ? nodes.filter(({ role }) => role !== "root")
      : nodes;
    return focusedNodes.length > 0 ? focusedNodes : nodes;
  }, [mobile, nodes, selectedDomain]);
  const graphFrame = useMemo(
    () =>
      frameSpatialNodes({
        nodes: framedNodes,
        aspect: size.width / Math.max(size.height, 1),
        verticalFovDegrees,
        nodeBoundRadius: selectedDomain ? (mobile ? 1.1 : 1.15) : 0.6,
        margin: selectedDomain ? (mobile ? 1.6 : 1.28) : 1.16,
        worldOffset: graphWorldOffset,
        viewPlaneOffset:
          mobile
            ? selectedDomain
              ? [0, 0.5]
              : [0, 0]
            : selectedDomain
              ? [1.8, -0.22]
              : [1.15, -0.48],
        viewDirection: selectedDomainRecord
          ? mobile
            ? [
                Math.cos(selectedDomainRecord.angle),
                0.08,
                Math.sin(selectedDomainRecord.angle),
              ]
            : [
                Math.cos(selectedDomainRecord.angle + Math.PI / 4),
                0.38,
                Math.sin(selectedDomainRecord.angle + Math.PI / 4),
              ]
          : undefined,
        viewUp:
          selectedDomainRecord && mobile
            ? [
                -Math.sin(selectedDomainRecord.angle),
                0,
                Math.cos(selectedDomainRecord.angle),
              ]
            : undefined,
      }),
    [
      framedNodes,
      mobile,
      selectedDomain,
      selectedDomainRecord,
      size.height,
      size.width,
      verticalFovDegrees,
    ],
  );
  const destination = useMemo(() => {
    if (phase === "body" || phase === "returning") {
      return {
        position: [0, 1.35, 10] as Point3,
        target: [0, 1.35, 0] as Point3,
        up: [0, 1, 0] as Point3,
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
  const destinationUp = useMemo(
    () => new THREE.Vector3(...destination.up),
    [destination.up],
  );

  useEffect(() => {
    phaseStarted.current = performance.now();
    start.current.copy(camera.position);
    startUp.current.copy(camera.up);
    guiding.current = true;
    if (controls.current) controls.current.enabled = false;
  }, [camera, destinationPosition, destinationTarget, destinationUp]);

  useFrame(() => {
    if (!guiding.current) return;

    if (directGraphEntry.current && phase === "graph") {
      directGraphEntry.current = false;
      camera.position.copy(destinationPosition);
      camera.up.copy(destinationUp);
      camera.lookAt(destinationTarget);
      guiding.current = false;
      if (controls.current) {
        controls.current.target.copy(destinationTarget);
        controls.current.update();
        controls.current.enabled = true;
      }
      return;
    }

    if (phase === "entering") {
      const elapsed = performance.now() - phaseStarted.current;
      const raw = reducedMotion ? 1 : Math.min(elapsed / 1500, 1);
      const eased = raw * raw * (3 - 2 * raw);
      camera.position.copy(
        start.current.clone().lerp(destinationPosition, eased),
      );
      camera.up.lerpVectors(startUp.current, destinationUp, eased).normalize();
      camera.lookAt(destinationTarget);
      if (raw === 1) guiding.current = false;
      return;
    }

    const interpolation = reducedMotion ? 1 : phase === "body" ? 0.06 : 0.055;
    camera.position.lerp(destinationPosition, interpolation);
    camera.up.lerp(destinationUp, interpolation).normalize();
    camera.lookAt(destinationTarget);
    if (camera.position.distanceTo(destinationPosition) < 0.015) {
      camera.position.copy(destinationPosition);
      camera.lookAt(destinationTarget);
      guiding.current = false;
      if (controls.current && phase === "graph") {
        controls.current.target.copy(destinationTarget);
        controls.current.update();
        controls.current.enabled = true;
      }
    }
  });

  const fog = phase === "graph" ? graphFrame.fog : { near: 11, far: 30 };

  return (
    <>
      <fog attach="fog" args={["#f4f1e8", fog.near, fog.far]} />
      {phase === "graph" && !mobile ? (
        <OrbitControls
          ref={controls}
          enabled
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
      ) : null}
    </>
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
  onEnter: () => void;
  onNodeSelect: (node: SpatialGraphNode) => void;
};

export function PortfolioCanvas({
  phase,
  nodes,
  pose,
  selectedDomain,
  reducedMotion,
  focusedNodeId,
  selectedNodeId,
  onEnter,
  onNodeSelect,
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
        <ambientLight intensity={1.05} color="#ffffff" />
        <directionalLight position={[4, 8, 7]} intensity={2} color="#fff4cf" />
        <pointLight position={[-5, 1, 2]} intensity={8} distance={12} color="#3d7c6c" />
        <Suspense fallback={null}>
          <BodyScene
            interactive={phase === "body"}
            onActivate={onEnter}
            pose={pose}
            quality={quality}
          />
          <BrainGraph
            phase={phase}
            nodes={nodes}
            focusedNodeId={focusedNodeId}
            selectedNodeId={selectedNodeId}
            selectedDomain={selectedDomain}
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
