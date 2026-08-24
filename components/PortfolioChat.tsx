"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  PortfolioChatClientError,
  requestPortfolioChatPreviewAccess,
  streamPortfolioAnswer,
  type AskPortfolio,
  type RequestPortfolioChatPreviewAccess,
} from "../lib/portfolio-chat-client";
import type { PortfolioGroundingEvidence } from "../lib/portfolio-grounding";
import { classifyPose } from "../lib/pose";
import type { PoseState } from "./scene/BodyScene";

const starterQuestions = [
  "How does the pitching system preserve human approval?",
  "How does reporting turn campaign activity into client evidence?",
  "How does Bradley decide what to automate?",
] as const;

const stageRoleLabels = {
  instinct: "Instinct",
  approach: "Approach",
  output: "Output",
} as const;

export function PortfolioChat({
  onPoseChange,
  askPortfolio = streamPortfolioAnswer,
  requestPreviewAccess = requestPortfolioChatPreviewAccess,
}: {
  onPoseChange: (pose: PoseState) => void;
  askPortfolio?: AskPortfolio;
  requestPreviewAccess?: RequestPortfolioChatPreviewAccess;
}) {
  const [input, setInput] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [answer, setAnswer] = useState("");
  const [evidence, setEvidence] = useState<PortfolioGroundingEvidence[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [previewRequired, setPreviewRequired] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const previewController = useRef<AbortController | null>(null);
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
      previewController.current?.abort();
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
    setPreviewRequired(false);
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
      if (
        error instanceof PortfolioChatClientError &&
        error.code === "preview_required"
      ) {
        setPreviewRequired(true);
      }
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
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const starterQuestion =
      submitter instanceof HTMLButtonElement &&
      submitter.name === "starterQuestion"
        ? submitter.value
        : "";
    const question = starterQuestion || input.trim();
    if (!question) return;
    if (starterQuestion) setInput(starterQuestion);
    setPoseForQuestion(question);
    void runQuestion(question);
  }

  async function submitPreviewAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = accessCode.trim();
    if (!code) return;
    previewController.current?.abort();
    const controller = new AbortController();
    previewController.current = controller;
    setPreviewPending(true);
    setMessage("");

    try {
      await requestPreviewAccess(code, { signal: controller.signal });
      setAccessCode("");
      setPreviewRequired(false);
      setMessage("Preview access ready. Ask again when you're ready.");
    } catch (error) {
      if (controller.signal.aborted) return;
      setMessage(
        error instanceof PortfolioChatClientError
          ? error.message
          : "The answer service is temporarily unavailable.",
      );
    } finally {
      if (previewController.current === controller) {
        previewController.current = null;
        setPreviewPending(false);
      }
    }
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
      <div className="chat-starters" aria-label="Suggested portfolio questions">
        {starterQuestions.map((question) => (
          <button
            disabled={pending}
            form="portfolio-question-form"
            key={question}
            name="starterQuestion"
            type="submit"
            value={question}
          >
            {question}
          </button>
        ))}
      </div>
      <form id="portfolio-question-form" onSubmit={submit}>
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
      {previewRequired ? (
        <form className="chat-preview-access" onSubmit={submitPreviewAccess}>
          <label htmlFor="portfolio-preview-code">Preview access code</label>
          <div>
            <input
              autoComplete="off"
              id="portfolio-preview-code"
              name="accessCode"
              onChange={(event) => setAccessCode(event.target.value)}
              type="password"
              value={accessCode}
            />
            <button disabled={previewPending} type="submit">
              {previewPending ? "Unlocking…" : "Unlock preview"}
            </button>
          </div>
        </form>
      ) : null}
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
                      <div className="chat-evidence-labels">
                        {item.stageRole ? (
                          <span>{stageRoleLabels[item.stageRole]}</span>
                        ) : null}
                        <span>Evidence {item.evidenceStatus}</span>
                      </div>
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
