"use client";

import "./avatar-director-console.css";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { avatarBehaviors } from "../../lib/avatar/behaviors";
import { AvatarController } from "../../lib/avatar/controller";
import { AvatarDirector } from "../../lib/avatar/director";
import {
  allowedAvatarStates,
  type AvatarCommand,
  type AvatarTargetId,
  type AvatarTone,
} from "../../lib/avatar/contracts";
import { AvatarSequenceRunner } from "../../lib/avatar/sequence-runner";
import { adaptCommandsForReducedMotion } from "../../lib/avatar/state";
import {
  AvatarTargetRegistry,
  type AvatarStageMap,
} from "../../lib/avatar/target-registry";

type DirectorTab = "Scenes" | "Target" | "Movement" | "Advanced";

type AvatarDirectorConsoleProps = {
  controller: AvatarController;
  director: AvatarDirector;
  registry: AvatarTargetRegistry;
  runner: AvatarSequenceRunner;
  onEnabledChange: (enabled: boolean) => void;
  onExpandedPanelChange?: (element: HTMLDivElement | null) => void;
  reducedMotion?: boolean;
};

const tabs: readonly DirectorTab[] = ["Scenes", "Target", "Movement", "Advanced"];
const debugTargets: readonly AvatarTargetId[] = [
  "hero",
  "portfolio:chat",
  "portfolio:index",
  "project:dubs",
];
const tonePresets: ReadonlyArray<{ label: string; tone: AvatarTone }> = [
  { label: "Quiet tone", tone: { energy: "low", warmth: "warm", confidence: "neutral", mischief: "none" } },
  { label: "Neutral tone", tone: { energy: "medium", warmth: "warm", confidence: "neutral", mischief: "none" } },
  { label: "Assured tone", tone: { energy: "high", warmth: "reserved", confidence: "assured", mischief: "none" } },
  { label: "Playful tone", tone: { energy: "high", warmth: "warm", confidence: "assured", mischief: "playful" } },
];

function targetLabel(target: AvatarTargetId) {
  return target;
}

function isProjectTarget(target: AvatarTargetId | null): target is `project:${string}` {
  return target?.startsWith("project:") ?? false;
}

function percentage(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return "0%";
  const clamped = Math.min(total, Math.max(0, value));
  return `${(clamped / total) * 100}%`;
}

function mapStyle(
  bounds: AvatarStageMap["targets"][number]["bounds"],
  viewport: AvatarStageMap["viewport"],
) {
  const left = Math.min(viewport.width, Math.max(0, bounds.left));
  const top = Math.min(viewport.height, Math.max(0, bounds.top));
  const right = Math.min(viewport.width, Math.max(left, bounds.right));
  const bottom = Math.min(viewport.height, Math.max(top, bounds.bottom));
  return {
    left: percentage(left, viewport.width),
    top: percentage(top, viewport.height),
    width: percentage(right - left, viewport.width),
    height: percentage(bottom - top, viewport.height),
  };
}

function statusText(snapshot: ReturnType<AvatarController["getSnapshot"]>) {
  return `State: ${snapshot.state} · Clip: ${snapshot.animation} · Target: ${snapshot.target ?? "none"} · Locomotion: ${snapshot.locomotion} · Renderer: ${snapshot.failed ? "failed" : "ready"}`;
}

export function AvatarDirectorConsole({
  controller,
  director,
  registry,
  onEnabledChange,
  onExpandedPanelChange,
  reducedMotion = false,
}: AvatarDirectorConsoleProps) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [tab, setTab] = useState<DirectorTab>("Scenes");
  const [collapsed, setCollapsed] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<AvatarTargetId | null>(null);
  const [stageMap, setStageMap] = useState<AvatarStageMap>(() => registry.resolveStageMap());
  const expandedPanel = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Partial<Record<DirectorTab, HTMLButtonElement | null>>>({});

  const refreshStageMap = useCallback(() => {
    const nextMap = registry.resolveStageMap();
    setStageMap(nextMap);
    setSelectedTarget((current) =>
      current && nextMap.targets.some(({ target }) => target === current)
        ? current
        : nextMap.targets[0]?.target ?? null,
    );
  }, [registry]);

  useEffect(() => {
    if (tab !== "Target") return;
    window.addEventListener("resize", refreshStageMap);
    window.addEventListener("scroll", refreshStageMap, true);
    return () => {
      window.removeEventListener("resize", refreshStageMap);
      window.removeEventListener("scroll", refreshStageMap, true);
    };
  }, [refreshStageMap, tab]);

  useEffect(() => {
    const panel = collapsed ? null : expandedPanel.current;
    onExpandedPanelChange?.(panel);
    return () => onExpandedPanelChange?.(null);
  }, [collapsed, onExpandedPanelChange]);

  const run = useCallback((commands: readonly AvatarCommand[]) =>
    director.runOperatorSequence(
      reducedMotion ? adaptCommandsForReducedMotion(commands) : commands,
    ),
  [director, reducedMotion]);
  const runTarget = useCallback((action: "walkTo" | "swimTo" | "lookAt" | "pointAt") => {
    if (!selectedTarget) return;
    void run([{ action, target: selectedTarget }]);
  }, [run, selectedTarget]);
  const selectTarget = useCallback((target: AvatarTargetId) => {
    setSelectedTarget(target);
  }, []);
  const reset = useCallback(() => {
    director.stop();
    controller.reset();
    controller.setVisible(true);
    onEnabledChange(true);
  }, [controller, director, onEnabledChange]);
  const toggleVisibility = useCallback(() => {
    const visible = !snapshot.visible;
    controller.setVisible(visible);
    onEnabledChange(visible);
  }, [controller, onEnabledChange, snapshot.visible]);
  const visibleTargets = stageMap.targets.filter(({ bounds }) => bounds.inViewport);
  const presentProject = useCallback(async () => {
    if (!isProjectTarget(selectedTarget)) return;
    await run([
      { action: "walkTo", target: selectedTarget },
      { action: "pointAt", target: selectedTarget },
      { action: "wait", durationMs: 900 },
    ]);
    await run([{ action: "setState", state: "idle" }]);
  }, [run, selectedTarget]);
  const activateTab = useCallback((nextTab: DirectorTab) => {
    if (nextTab === "Target") refreshStageMap();
    setTab(nextTab);
  }, [refreshStageMap]);
  const onTabKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, current: DirectorTab) => {
    const currentIndex = tabs.indexOf(current);
    const nextIndex = event.key === "ArrowRight"
      ? (currentIndex + 1) % tabs.length
      : event.key === "ArrowLeft"
        ? (currentIndex - 1 + tabs.length) % tabs.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex]!;
    activateTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  }, [activateTab]);

  const scene = (name: string) => {
    switch (name) {
      case "Greet":
        void run([
          ...(snapshot.visible ? [] : [{ action: "enter" as const, from: "left" as const }]),
          { action: "walkTo", target: "portfolio:index" },
          { action: "play", animation: "wave_one_hand" },
          { action: "wait", durationMs: 900 },
          { action: "setState", state: "idle" },
        ]);
        return;
      case "Present project":
        void presentProject();
        return;
      case "Answer":
        void run([
          { action: "lookAt", target: "portfolio:chat" },
          { action: "setState", state: "thinking" },
          { action: "wait", durationMs: 750 },
          { action: "setState", state: "talking" },
          { action: "wait", durationMs: 900 },
          { action: "setState", state: "idle" },
        ]);
        return;
      case "Celebrate":
        void run([
          { action: "setState", state: "success" },
          { action: "play", animation: "cheer_with_both_hands_1" },
          { action: "wait", durationMs: 1_200 },
          { action: "setState", state: "idle" },
        ]);
        return;
      case "Dance":
        void run([
          { action: "setTone", tone: tonePresets[3]!.tone },
          { action: "play", animation: "joyful_dance_with_hand_sway" },
          { action: "wait", durationMs: 1_200 },
          { action: "setState", state: "idle" },
        ]);
        return;
      case "Swim lap":
        void run([
          { action: "play", animation: "swim_forward" },
          { action: "swimRoute", route: "lap" },
          { action: "setState", state: "idle" },
        ]);
        return;
      case "Come home":
        void run([
          { action: "walkTo", target: "portfolio:index" },
          { action: "lookAt", target: "portfolio:index" },
          { action: "setState", state: "idle" },
        ]);
    }
  };

  return (
    <section
      aria-label="Avatar Director console"
      className="avatar-director-console"
      data-avatar-renderer-status={snapshot.failed ? "failed" : "ready"}
    >
      <header className="avatar-director-console-status">
        <p
          aria-live="polite"
          data-avatar-renderer-status={snapshot.failed ? "failed" : "ready"}
        >
          {statusText(snapshot)}
        </p>
        <div>
          <button type="button" onClick={() => director.stop()}>Stop</button>
          <button type="button" onClick={reset}>Reset avatar</button>
          <button type="button" onClick={toggleVisibility}>{snapshot.visible ? "Hide assistant" : "Show assistant"}</button>
          <button type="button" onClick={() => setCollapsed((value) => !value)}>{collapsed ? "Expand console" : "Collapse console"}</button>
        </div>
      </header>
      {!collapsed ? (
        <div ref={expandedPanel} className="avatar-director-console-panel">
          <div role="tablist" aria-label="Director sections">
            {tabs.map((name) => (
              <button
                aria-controls={`avatar-director-${name.toLowerCase()}`}
                aria-selected={tab === name}
                id={`avatar-director-tab-${name.toLowerCase()}`}
                key={name}
                onClick={() => activateTab(name)}
                onKeyDown={(event) => onTabKeyDown(event, name)}
                ref={(element) => { tabRefs.current[name] = element; }}
                role="tab"
                tabIndex={tab === name ? 0 : -1}
                type="button"
              >
                {name}
              </button>
            ))}
          </div>
          {tab === "Scenes" ? (
            <div aria-labelledby="avatar-director-tab-scenes" id="avatar-director-scenes" role="tabpanel">
              <p>{reducedMotion ? "Reduced-motion scene recipes" : "Directed scene recipes"}</p>
              {["Greet", "Present project", "Answer", "Celebrate", "Dance", "Swim lap", "Come home"].map((name) => (
                <button
                  disabled={name === "Present project" && !isProjectTarget(selectedTarget)}
                  key={name}
                  type="button"
                  onClick={() => scene(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}
          {tab === "Target" ? (
            <div aria-labelledby="avatar-director-tab-target" id="avatar-director-target" role="tabpanel">
              <div aria-label="Live stage map" role="group">
                {stageMap.targets.map(({ target, bounds }) => (
                  <button
                    aria-pressed={selectedTarget === target}
                    data-avatar-map-target="true"
                    key={target}
                    onClick={() => selectTarget(target)}
                    style={mapStyle(bounds, stageMap.viewport)}
                    type="button"
                  >
                    Select {targetLabel(target)}
                  </button>
                ))}
                {stageMap.obstacles.map(({ obstacle, bounds }) => (
                  <span aria-label={`Obstacle ${obstacle}`} key={obstacle} style={mapStyle(bounds, stageMap.viewport)} />
                ))}
              </div>
              <p>Selected target: {selectedTarget ?? "none"}</p>
              <button disabled={!selectedTarget} type="button" onClick={() => runTarget("walkTo")}>Walk to {selectedTarget ?? "selected target"}</button>
              <button disabled={!selectedTarget} type="button" onClick={() => runTarget("swimTo")}>Swim to {selectedTarget ?? "selected target"}</button>
              <button disabled={!selectedTarget} type="button" onClick={() => runTarget("lookAt")}>Look at {selectedTarget ?? "selected target"}</button>
              <button disabled={!selectedTarget} type="button" onClick={() => runTarget("pointAt")}>Point at {selectedTarget ?? "selected target"}</button>
              <button disabled={!isProjectTarget(selectedTarget)} type="button" onClick={() => void presentProject()}>Present {selectedTarget ?? "selected project"}</button>
              <p>{visibleTargets.length} live semantic targets</p>
            </div>
          ) : null}
          {tab === "Movement" ? (
            <div aria-labelledby="avatar-director-tab-movement" id="avatar-director-movement" role="tabpanel">
              <button type="button" onClick={() => void run([{ action: "enter", from: "left" }])}>Enter left</button>
              <button type="button" onClick={() => void run([{ action: "enter", from: "right" }])}>Enter right</button>
              <button type="button" onClick={() => void run([{ action: "exit", to: "left" }])}>Exit left</button>
              <button type="button" onClick={() => void run([{ action: "exit", to: "right" }])}>Exit right</button>
              <button type="button" onClick={() => void run([{ action: "swimRoute", route: "lap" }])}>Swim lap</button>
              <button type="button" onClick={() => runTarget("swimTo")}>Swim to target</button>
              <button type="button" onClick={() => scene("Come home")}>Home dock</button>
            </div>
          ) : null}
          {tab === "Advanced" ? (
            <div aria-labelledby="avatar-director-tab-advanced" id="avatar-director-advanced" role="tabpanel">
              <p>position={Math.round(snapshot.position.x)},{Math.round(snapshot.position.y)} · locomotion={snapshot.locomotion} · path={snapshot.motion?.kind ?? "none"} · facing={snapshot.facing} · target={snapshot.target ?? "none"} · point={snapshot.pointing ?? "none"}</p>
              <p>tone={snapshot.tone.energy}/{snapshot.tone.warmth}/{snapshot.tone.confidence}/{snapshot.tone.mischief}</p>
              <h3>State</h3>
              {allowedAvatarStates.map((state) => <button key={state} type="button" onClick={() => void run([{ action: "setState", state }])}>State: {state}</button>)}
              <h3>Tone</h3>
              {tonePresets.map(({ label, tone }) => <button key={label} type="button" onClick={() => void run([{ action: "setTone", tone }])}>{label}</button>)}
              <h3>Behaviors</h3>
              {avatarBehaviors.map(({ id, label }) => <button key={id} type="button" onClick={() => void run([{ action: "play", animation: id }])}>{label}</button>)}
              <h3>Stage</h3>
              <button type="button" onClick={() => void run([{ action: "enter", from: "left" }])}>Enter left</button>
              <button type="button" onClick={() => void run([{ action: "enter", from: "right" }])}>Enter right</button>
              <button type="button" onClick={() => void run([{ action: "exit", to: "left" }])}>Exit left</button>
              <button type="button" onClick={() => void run([{ action: "exit", to: "right" }])}>Exit right</button>
              {debugTargets.map((target) => <span key={target}><button type="button" onClick={() => void run([{ action: "walkTo", target }])}>Walk to {target}</button><button type="button" onClick={() => void run([{ action: "lookAt", target }])}>Look at {target}</button><button type="button" onClick={() => void run([{ action: "pointAt", target }])}>Point at {target}</button></span>)}
              <h3>Context</h3>
              <button type="button" onClick={() => void director.handle({ type: "input_focus" })}>Simulate listening</button>
              <button type="button" onClick={() => void director.handle({ type: "input_activity" })}>Simulate typing</button>
              <button type="button" onClick={() => void director.handle({ type: "turn_start" })}>Simulate thinking</button>
              <button type="button" onClick={() => void director.handle({ type: "evidence" })}>Simulate tool use</button>
              <button type="button" onClick={() => void director.handle({ type: "first_text" })}>Simulate talking</button>
              <button type="button" onClick={() => void director.handle({ type: "turn_complete" })}>Simulate completion</button>
              <button type="button" onClick={() => void director.onAmbientTick()}>Run ambient tick</button>
              <button type="button" onClick={() => void director.handle({ type: "project_open", target: "project:dubs" })}>Simulate project hosting</button>
              <button type="button" onClick={() => void director.handle({ type: "tab_change", target: "project:dubs" })}>Simulate tab change</button>
              <button type="button" onClick={() => void director.handle({ type: "project_close" })}>Simulate project close</button>
              <button type="button" onClick={() => void director.perform({ avatarSequence: [{ action: "play", animation: "wave_one_hand" }, { action: "wait", durationMs: 1_200 }, { action: "play", animation: "joyful_dance_with_hand_sway" }], avatarIntent: "requested", avatarTone: tonePresets[3]!.tone, issues: [] })}>Run wave dance performance</button>
              <h3>Page and failure</h3>
              <button type="button" onClick={() => controller.markFailed()}>Simulate failure</button>
              <button type="button" onClick={reset}>Reset avatar</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
