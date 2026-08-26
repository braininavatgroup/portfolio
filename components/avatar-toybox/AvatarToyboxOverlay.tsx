"use client";

/* eslint-disable react-hooks/refs -- The session prop is a plain public snapshot plus event callbacks; this renderer never reads a React ref. */

import { Canvas } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { defaultAvatarTone } from "../../lib/avatar/contracts";
import type { AvatarToyboxSession } from "./useAvatarToyboxSession";
import { AvatarAssetAdapter } from "../avatar/AvatarAssetAdapter";

function ToyboxAvatar({ session }: { session: AvatarToyboxSession }) {
  const hitboxRef = useRef<HTMLDivElement>(null);
  const tossing = session.status === "tossing";
  const body = tossing ? session.tossBody : session.brainBody;
  const rotation = tossing ? session.tossBody.rotation : 0;
  const impact = tossing ? session.tossBody.impact : 0;
  const floorDistance = tossing
    ? Math.max(0, window.innerHeight - (session.tossBody.position.y + 104))
    : 0;
  const shadowScale = Math.max(0.45, 1 - floorDistance / 700);
  const facing = tossing
    ? session.tossBody.velocity.x < -8
      ? "left"
      : "right"
    : "front";

  useLayoutEffect(() => {
    const element = hitboxRef.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      session.setHitboxSize({ width: bounds.width || 144, height: bounds.height || 208 });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [session]);

  return (
    <>
      {tossing ? (
        <span
          aria-hidden="true"
          className="avatar-toybox-avatar-shadow"
          style={{
            left: `${body.position.x}px`,
            opacity: Math.max(0.08, 0.24 - floorDistance / 2500),
            transform: `translateX(-50%) scale(${shadowScale})`,
          }}
        />
      ) : null}
      <div
      aria-label={tossing ? "Bradley. Drag and release to toss." : undefined}
      className={`avatar-toybox-avatar${tossing ? " avatar-toybox-avatar-tossable" : ""}${session.tossBody.dragging ? " avatar-toybox-avatar-dragging" : ""}`}
      onLostPointerCapture={(event) => session.losePointerCapture(event.pointerId)}
      onPointerCancel={session.cancelDrag}
      onPointerDown={
        tossing
          ? (event) => {
              event.preventDefault();
              session.beginDrag(
                event.pointerId,
                { x: event.clientX, y: event.clientY },
                event.currentTarget,
                event.timeStamp,
              );
            }
          : undefined
      }
      onPointerMove={
        tossing
          ? (event) => session.moveDrag(
              event.pointerId,
              { x: event.clientX, y: event.clientY },
              event.timeStamp,
            )
          : undefined
      }
      onPointerUp={
        tossing
          ? (event) => session.endDrag(
              event.pointerId,
              { x: event.clientX, y: event.clientY },
              event.timeStamp,
            )
          : undefined
      }
      ref={hitboxRef}
      style={{
        left: `${body.position.x}px`,
        top: `${body.position.y}px`,
        transform: `translate3d(-50%, -50%, 0) rotate(${rotation}rad) scale(${1 + impact * 0.07}, ${1 - impact * 0.09})`,
      }}
    >
      <Canvas
        aria-hidden="true"
        camera={{ position: [0, 1.1, 4.2], fov: 30 }}
        className="avatar-toybox-avatar-canvas"
        dpr={[1, 1.25]}
        frameloop={document.hidden ? "never" : "always"}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.6} />
        <directionalLight intensity={1.7} position={[2, 4, 3]} />
        <AvatarAssetAdapter
          anchor="center"
          animation={!tossing && session.brainBody.moving ? "walking" : "idle_3"}
          facing={facing}
          pointing={null}
          reducedMotion={session.reducedMotion}
          tone={defaultAvatarTone}
        />
      </Canvas>
      </div>
    </>
  );
}

export function AvatarToyboxOverlay({ session }: { session: AvatarToyboxSession }) {
  if (!session.isOpen) return null;
  const root = document.getElementById("avatar-toybox-root");
  if (!root) return null;

  const labels = new Map(session.roster.map((item) => [item.id, item]));
  const showField = session.status === "collecting" || session.status === "result" || session.status === "tossing";

  return createPortal(
    <section
      aria-labelledby="avatar-toybox-title"
      aria-modal="true"
      className={`avatar-toybox avatar-toybox-${session.status}`}
      ref={session.modalRef}
      role="dialog"
      tabIndex={-1}
    >
      <div aria-atomic="true" aria-live="polite" className="avatar-toybox-sr-status">
        {session.announcement}
      </div>

      <header className="avatar-toybox-hud">
        <div>
          <p className="eyebrow">Secret avatar toybox</p>
          <h2 id="avatar-toybox-title">Avatar toybox</h2>
        </div>
        {session.status === "collecting" ? (
          <p aria-label="Brain Food score and time">
            Score {session.score} of {session.collectibles.length} · {session.remainingSeconds}s
          </p>
        ) : session.status === "result" ? (
          <p>Returning to portfolio...</p>
        ) : session.status === "tossing" ? (
          <p>Drag + release · R reset · Esc exits</p>
        ) : (
          <p>Press 1 or 2 · Esc exits</p>
        )}
        <button className="avatar-toybox-exit" onClick={() => session.close()} type="button">
          Close game
        </button>
      </header>

      {session.status === "choosing" ? (
        <div className="avatar-toybox-chooser">
          <p>You found the toybox. Pick a tiny diversion.</p>
          <div className="avatar-toybox-choices">
            <button
              data-avatar-toybox-initial-focus
              onClick={session.startCollecting}
              type="button"
            >
              <span>1</span>
              <strong>Brain Food</strong>
              <small>Steer Bradley through the work.</small>
            </button>
            <button onClick={session.startTossing} type="button">
              <span>2</span>
              <strong>Toss Bradley</strong>
              <small>Pick him up and let cartoon gravity take over.</small>
            </button>
          </div>
        </div>
      ) : null}

      {showField ? (
        <div className="avatar-toybox-field">
          {session.status === "result" ? (
            <button
              aria-label="Close game from playfield"
              className="avatar-toybox-result-dismiss"
              onClick={() => session.close()}
              type="button"
            />
          ) : null}
          {session.status !== "tossing"
            ? session.collectibles.map((collectible) => {
                if (collectible.eaten) return null;
                const item = labels.get(collectible.id);
                return (
                  <span
                    aria-label={`Collect ${item?.label ?? collectible.id}`}
                    className="avatar-toybox-collectible"
                    data-token-kind={item?.tokenKind}
                    key={collectible.id}
                    role="img"
                    style={{
                      left: `${collectible.position.x}px`,
                      top: `${collectible.position.y}px`,
                    }}
                  >
                    <span aria-hidden="true">✦</span>
                    <small>{item?.label ?? collectible.id}</small>
                  </span>
                );
              })
            : null}
          <ToyboxAvatar session={session} />
          {session.status === "result" ? (
            <div className="avatar-toybox-result">
              <button
                aria-label="Close completed game"
                className="avatar-toybox-result-close"
                data-avatar-toybox-initial-focus
                onClick={() => session.close()}
                type="button"
              >
                ×
              </button>
              <p className="eyebrow">
                {session.resultKind === "toss" ? "Toss complete" : "Round complete"}
              </p>
              <strong>
                {session.resultKind === "toss"
                  ? "Bradley stuck the landing"
                  : `${session.score} of ${session.collectibles.length} collected`}
              </strong>
              <p>Returning to the portfolio in five seconds.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>,
    root,
  );
}
