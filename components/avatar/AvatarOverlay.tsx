"use client";

import { Canvas } from "@react-three/fiber";
import {
  Component,
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { AvatarController } from "../../lib/avatar/controller";
import { AvatarSequenceRunner } from "../../lib/avatar/sequence-runner";
import { SiteActionExecutor } from "../../lib/avatar/site-actions";
import { AvatarAssetAdapter } from "./AvatarAssetAdapter";
import { AvatarDevHarness } from "./AvatarDevHarness";

type AvatarOverlayProps = {
  controller: AvatarController;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  development?: boolean;
  debug?: boolean;
  runner?: AvatarSequenceRunner;
  siteActionExecutor?: SiteActionExecutor;
};

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
  enabled,
  onEnabledChange,
  development = false,
  debug = false,
  runner,
  siteActionExecutor,
}: AvatarOverlayProps) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const documentVisible = useDocumentVisible();

  useEffect(() => {
    controller.setVisible(enabled);
  }, [controller, enabled]);

  const isEnabled = enabled && snapshot.visible;
  const toggle = () => {
    const nextEnabled = !isEnabled;
    controller.setVisible(nextEnabled);
    onEnabledChange(nextEnabled);
  };
  const renderAvatar = isEnabled && snapshot.visible && !snapshot.failed;

  return (
    <div
      className="avatar-overlay pointer-events-none"
      data-avatar-state={snapshot.state}
      style={{ left: `${snapshot.anchorX}px`, pointerEvents: "none" }}
    >
      {renderAvatar ? (
        <RendererBoundary onFailure={() => controller.markFailed()}>
          <Canvas
            aria-hidden="true"
            camera={{ position: [0, 1.1, 4.2], fov: 30 }}
            className="avatar-overlay-canvas"
            dpr={[1, 1.25]}
            frameloop={documentVisible ? "always" : "never"}
            gl={{ alpha: true, antialias: true }}
            style={{ pointerEvents: "none" }}
          >
            <ambientLight intensity={1.6} />
            <directionalLight intensity={1.7} position={[2, 4, 3]} />
            <AvatarAssetAdapter
              animation={snapshot.animation}
              facing={snapshot.facing}
              pointing={snapshot.pointing}
            />
          </Canvas>
        </RendererBoundary>
      ) : null}
      <button
        aria-label={isEnabled ? "Hide assistant" : "Show assistant"}
        className="avatar-overlay-toggle pointer-events-auto"
        onClick={toggle}
        style={{ pointerEvents: "auto" }}
        type="button"
      >
        {isEnabled ? "Hide assistant" : "Show assistant"}
      </button>
      {development && debug ? (
        <AvatarDevHarness
          controller={controller}
          runner={runner}
          siteActionExecutor={siteActionExecutor}
        />
      ) : null}
    </div>
  );
}
