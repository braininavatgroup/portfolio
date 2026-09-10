"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import * as THREE from "three";
import type { AvatarRuntime } from "../../lib/avatar/runtime";
import { AvatarStageActor } from "./AvatarStageActor";

type AvatarOverlayProps = {
  runtime: AvatarRuntime;
  reducedMotion?: boolean;
  createRenderer?: AvatarRendererFactory;
};

type CanvasRendererFactory = Extract<
  NonNullable<CanvasProps["gl"]>,
  (...args: never[]) => unknown
>;
type AvatarRendererProps = Parameters<CanvasRendererFactory>[0];
type AvatarRendererFactory = (
  props: AvatarRendererProps,
) => THREE.WebGLRenderer;

const createDefaultRenderer: AvatarRendererFactory = (props) =>
  new THREE.WebGLRenderer({ ...props, alpha: true, antialias: true });

async function initializeRenderer(
  props: AvatarRendererProps,
  createRenderer: AvatarRendererFactory,
  onFailure: () => void,
) {
  try {
    return createRenderer(props);
  } catch {
    queueMicrotask(onFailure);
    return new Promise<THREE.WebGLRenderer>(() => {});
  }
}

type RendererBoundaryProps = {
  onFailure: () => void;
  children: ReactNode;
};

class RendererBoundary extends Component<
  RendererBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function useDocumentVisible() {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return visible;
}

export function AvatarOverlay({
  runtime,
  reducedMotion = false,
  createRenderer = createDefaultRenderer,
}: AvatarOverlayProps) {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const documentVisible = useDocumentVisible();
  const createManagedRenderer = useCallback(
    (props: AvatarRendererProps) =>
      initializeRenderer(props, createRenderer, runtime.markFailed),
    [createRenderer, runtime],
  );

  useEffect(() => {
    if (!documentVisible && snapshot.phase !== "brain-food") runtime.cancel();
  }, [documentVisible, runtime, snapshot.phase]);

  // The canvas mounts on the first show and then stays mounted while hidden.
  // Unmounting it mid-reconfigure (a resize followed by a hide) let
  // react-three-fiber reconnect events into a removed wrapper. Hidden simply
  // leaves the page and pauses the frameloop.
  const [everVisible, setEverVisible] = useState(snapshot.visible);
  if (snapshot.visible && !everVisible) setEverVisible(true);
  const renderAvatar = everVisible && !snapshot.failed;
  const runFrames = documentVisible && snapshot.visible;

  return (
    <div
      className="avatar-overlay"
      data-avatar-state={snapshot.phase}
      hidden={!snapshot.visible}
    >
      {renderAvatar ? (
        <RendererBoundary onFailure={() => runtime.markFailed()}>
          <Canvas
            aria-hidden="true"
            camera={{ far: 2_500, position: [0, 0, 1_000], zoom: 1 }}
            className="avatar-overlay-canvas"
            dpr={[1, 1.25]}
            frameloop={runFrames ? reducedMotion ? "demand" : "always" : "never"}
            gl={createManagedRenderer}
            orthographic
          >
            <ambientLight intensity={1.6} />
            <directionalLight intensity={1.7} position={[2, 4, 3]} />
            <AvatarStageActor
              snapshot={snapshot}
              onAvailableAnimationsChange={runtime.setAvailableClips}
              reducedMotion={reducedMotion}
            />
          </Canvas>
        </RendererBoundary>
      ) : null}
    </div>
  );
}
