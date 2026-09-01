"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";
import {
  Component,
  lazy,
  Suspense,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import * as THREE from "three";
import { AvatarController } from "../../lib/avatar/controller";
import { AvatarDirector } from "../../lib/avatar/director";
import { AvatarSequenceRunner } from "../../lib/avatar/sequence-runner";
import { SiteActionExecutor } from "../../lib/avatar/site-actions";
import { AvatarTargetRegistry } from "../../lib/avatar/target-registry";
import { AvatarStageActor } from "./AvatarStageActor";

const AvatarDirectorConsole = import.meta.env.DEV
  ? lazy(() =>
      import("./AvatarDirectorConsole").then((module) => ({
        default: module.AvatarDirectorConsole,
      })),
    )
  : null;

type AvatarOverlayProps = {
  controller: AvatarController;
  director?: AvatarDirector;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  development?: boolean;
  debug?: boolean;
  runner?: AvatarSequenceRunner;
  registry?: AvatarTargetRegistry;
  siteActionExecutor?: SiteActionExecutor;
  reducedMotion?: boolean;
  onExpandedPanelChange?: (element: HTMLDivElement | null) => void;
  createRenderer?: AvatarRendererFactory;
};

type CanvasRendererFactory = Extract<
  NonNullable<CanvasProps["gl"]>,
  (...args: never[]) => unknown
>;
type AvatarRendererProps = Parameters<CanvasRendererFactory>[0];
type AvatarRendererFactory = (props: AvatarRendererProps) => THREE.WebGLRenderer;

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
    // R3F awaits this factory inside an unhandled async configure call. Convert
    // construction failure into controller state, then keep configure pending
    // only until React removes the failed canvas on the next microtask.
    queueMicrotask(onFailure);
    return new Promise<THREE.WebGLRenderer>(() => {});
  }
}

type RendererBoundaryProps = {
  onFailure: () => void;
  children: ReactNode;
};

class RendererBoundary extends Component<RendererBoundaryProps, { failed: boolean }> {
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
  controller,
  director,
  enabled,
  onEnabledChange,
  development = false,
  debug = false,
  runner,
  registry,
  siteActionExecutor,
  reducedMotion = false,
  onExpandedPanelChange,
  createRenderer = createDefaultRenderer,
}: AvatarOverlayProps) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const documentVisible = useDocumentVisible();
  const createManagedRenderer = useCallback(
    (props: AvatarRendererProps) =>
      initializeRenderer(props, createRenderer, () => controller.markFailed()),
    [controller, createRenderer],
  );

  useEffect(() => {
    controller.setVisible(enabled);
  }, [controller, enabled]);

  useEffect(() => {
    const controllerVisible = controller.getSnapshot().visible;
    if (controllerVisible !== enabled) onEnabledChange(controllerVisible);
  }, [controller, enabled, onEnabledChange, snapshot.visible]);

  useEffect(() => {
    if (documentVisible) return;
    if (director) {
      director.stop();
    } else {
      controller.stopMotion();
    }
  }, [controller, director, documentVisible]);

  const isEnabled = enabled && snapshot.visible;
  const renderAvatar = isEnabled && snapshot.visible && !snapshot.failed;

  return (
    <>
      <div
        className="avatar-overlay"
        data-avatar-state={snapshot.state}
        style={{ pointerEvents: "none" }}
      >
        {renderAvatar ? (
          <RendererBoundary onFailure={() => controller.markFailed()}>
            <Canvas
              aria-hidden="true"
              camera={{ far: 2_500, position: [0, 0, 1_000], zoom: 1 }}
              className="avatar-overlay-canvas"
              dpr={[1, 1.25]}
              frameloop={documentVisible ? "always" : "never"}
              gl={createManagedRenderer}
              orthographic
              style={{ pointerEvents: "none" }}
            >
              <ambientLight intensity={1.6} />
              <directionalLight intensity={1.7} position={[2, 4, 3]} />
              <AvatarStageActor
                snapshot={snapshot}
                onAvailableAnimationsChange={controller.setAvailableAnimations}
                reducedMotion={reducedMotion}
              />
            </Canvas>
          </RendererBoundary>
        ) : null}
      </div>
      {AvatarDirectorConsole && development && debug && director && runner && registry && siteActionExecutor ? (
        <Suspense fallback={null}>
          <AvatarDirectorConsole
            controller={controller}
            director={director}
            registry={registry}
            runner={runner}
            siteActionExecutor={siteActionExecutor}
            onEnabledChange={onEnabledChange}
            onExpandedPanelChange={onExpandedPanelChange}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      ) : null}
    </>
  );
}
