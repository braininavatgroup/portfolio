"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { classifyPose, poseReply, type PoseReply } from "../lib/pose";
import type { PoseState } from "./scene/BodyScene";

const questions = [
  "Where does judgment stay human?",
  "Show me a system someone else can run.",
  "Which work actually shipped?",
  "How did curator selection work?",
];

export function PortfolioChat({
  onPoseChange,
}: {
  onPoseChange: (pose: PoseState) => void;
}) {
  const [input, setInput] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [reply, setReply] = useState<PoseReply | null>(null);
  const idleTimer = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(
      () => setQuestionIndex((index) => (index + 1) % questions.length),
      4200,
    );
    return () => window.clearInterval(timer);
  }, []);

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
    <section className="portfolio-chat" aria-labelledby="chat-heading">
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
          placeholder={questions[questionIndex]}
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
      ) : (
        <p className="chat-note">Try one of the rotating questions or ask your own.</p>
      )}
    </section>
  );
}
