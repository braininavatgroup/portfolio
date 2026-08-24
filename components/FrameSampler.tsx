"use client";

import { useEffect, useRef, useState } from "react";
import { calculateFps } from "../lib/frame-sampler";

export function FrameSampler() {
  const [enabled, setEnabled] = useState(false);
  const [fps, setFps] = useState(0);
  const intervals = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let previous = performance.now();
    let frameCount = 0;

    function sample(now: number) {
      const delta = now - previous;
      previous = now;
      if (delta > 0 && delta < 250) {
        intervals.current.push(delta);
        if (intervals.current.length > 60) intervals.current.shift();
      }
      frameCount += 1;
      if (frameCount % 15 === 0) setFps(calculateFps(intervals.current));
      frame = requestAnimationFrame(sample);
    }

    frame = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(frame);
  }, [enabled]);

  if (process.env.NODE_ENV === "production") return null;

  return (
    // Dev-only control over the landing canvas; keep its clicks out of the
    // canvas-wide entry handler.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="frame-sampler" onClick={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => setEnabled((value) => !value)}>
        {enabled ? "Hide performance" : "Show performance"}
      </button>
      {enabled ? <output aria-live="polite">{fps || "…"} FPS</output> : null}
    </div>
  );
}
