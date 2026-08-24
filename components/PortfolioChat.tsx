"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { classifyPose, poseReply, type PoseReply } from "../lib/pose";
import type { PoseState } from "./scene/BodyScene";

export function PortfolioChat({
  onPoseChange,
}: {
  onPoseChange: (pose: PoseState) => void;
}) {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<PoseReply | null>(null);
  const idleTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    },
    [],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pose = classifyPose(input);
    if (pose === "idle") return;
    onPoseChange(pose);
    const nextReply = poseReply(input, pose);
    setReply(nextReply);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => onPoseChange("idle"), 4800);
  }

  return (
    // The chat is an explicit control over the landing canvas; its clicks
    // must never bubble into the canvas-wide entry handler.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <section
      className="portfolio-chat"
      aria-labelledby="chat-heading"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="chat-heading-row">
        <div>
          <p className="eyebrow">Ask the portfolio</p>
          <h2 id="chat-heading">Find the work behind the question.</h2>
        </div>
      </div>
      <form onSubmit={submit}>
        <label className="sr-only" htmlFor="portfolio-question">
          Ask a question about the portfolio
        </label>
        <input
          id="portfolio-question"
          name="question"
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about the work, decisions, or outcomes."
          type="text"
          value={input}
        />
        <button type="submit">Ask</button>
      </form>
      {reply ? (
        <div className="chat-reply" aria-live="polite">
          <p>{reply.text}</p>
          <Link href={reply.href}>{reply.linkLabel}</Link>
        </div>
      ) : null}
    </section>
  );
}
