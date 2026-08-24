"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  PortfolioChatClientError,
  streamPortfolioAnswer,
  type AskPortfolio,
} from "../lib/portfolio-chat-client";
import type { PortfolioGroundingEvidence } from "../lib/portfolio-grounding";
import { classifyPose } from "../lib/pose";
import type { PoseState } from "./scene/BodyScene";

export function PortfolioChat({
  onPoseChange,
  askPortfolio = streamPortfolioAnswer,
}: {
  onPoseChange: (pose: PoseState) => void;
  askPortfolio?: AskPortfolio;
}) {
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [evidence, setEvidence] = useState<PortfolioGroundingEvidence[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const chatRegion = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const region = chatRegion.current;
    const containInteraction = (event: Event) => event.stopPropagation();
    region?.addEventListener("click", containInteraction);
    region?.addEventListener("pointerdown", containInteraction);
    region?.addEventListener("pointerup", containInteraction);

    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      requestController.current?.abort();
      region?.removeEventListener("click", containInteraction);
      region?.removeEventListener("pointerdown", containInteraction);
      region?.removeEventListener("pointerup", containInteraction);
    };
  }, []);

  function setPoseForQuestion(question: string) {
    const pose = classifyPose(question);
    if (pose === "idle") return;
    onPoseChange(pose);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => onPoseChange("idle"), 4800);
  }

  async function runQuestion(question: string) {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setAnswer("");
    setEvidence([]);
    setMessage("");
    setPending(true);

    try {
      await askPortfolio(question, {
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "evidence") setEvidence(event.evidence);
          if (event.type === "answer_delta") {
            setAnswer((current) => current + event.delta);
          }
          if (event.type === "notice" || event.type === "error") {
            if (event.type === "error") setAnswer("");
            setMessage(event.message);
          }
          if (event.type === "done") setPending(false);
        },
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setAnswer("");
      setMessage(
        error instanceof PortfolioChatClientError
          ? error.message
          : "The answer service is temporarily unavailable.",
      );
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setPending(false);
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;
    setPoseForQuestion(question);
    void runQuestion(question);
  }

  return (
    <section
      ref={chatRegion}
      className="portfolio-chat"
      aria-labelledby="chat-heading"
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
        <button disabled={pending} type="submit">
          {pending ? "Asking…" : "Ask"}
        </button>
      </form>
      {answer || message || evidence.length > 0 || pending ? (
        <div className="chat-reply" aria-live="polite">
          {answer ? (
            <section aria-labelledby="chat-answer-heading" className="chat-answer">
              <h3 id="chat-answer-heading">Answer</h3>
              <p>{answer}</p>
            </section>
          ) : null}
          {message ? <p className="chat-message">{message}</p> : null}
          {pending && !answer ? <p className="chat-message">Reading the portfolio…</p> : null}
          {evidence.length > 0 ? (
            <section
              aria-labelledby="chat-evidence-heading"
              className="chat-evidence"
            >
              <h3 id="chat-evidence-heading">Supporting portfolio evidence</h3>
              <ol>
                {evidence.map((item, index) => (
                  <li key={item.id}>
                    <div>
                      <a href={item.href}>[E{index + 1}] {item.title}</a>
                      <span>Evidence {item.evidenceStatus}</span>
                    </div>
                    <p>{item.excerpt}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
