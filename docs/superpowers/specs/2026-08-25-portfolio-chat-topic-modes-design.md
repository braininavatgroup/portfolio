# Portfolio chat topic modes

## Product contract

The portfolio chat remains one OpenAI agent with the complete published portfolio supplied on every request. The agent classifies each turn into one of three modes before answering:

- `portfolio`: questions about Bradley, his work, projects, decisions, or contextual follow-ups. These answers remain evidence-grounded and deterministically citation-checked.
- `social`: greetings, thanks, jokes, reactions, and interpersonal small talk. These answers are natural, uncited, unlimited, and never redirect toward Bradley.
- `general`: unrelated factual questions, advice, and explanations. The first two are answered normally. The third is also answered, followed by one short, humorous, low-pressure invitation to ask about Bradley. Later general questions are answered without another nudge.

## Request and stream contract

The model emits `MODE: portfolio`, `MODE: social`, or `MODE: general` as a required first line. The provider buffers and strips that line, then reports the mode as an internal `turn_mode` stream event. A missing or malformed marker fails closed and is never shown to the visitor.

The browser sends `generalTurns` (capped at two) and `portfolioNudgeShown` with each request. The server, rather than the model, appends the one-time nudge after a successfully completed third general answer. The browser updates its values only after a terminal `done` event and a successfully closed stream. Social and portfolio turns do not change them. The state lives only in React memory, alongside the bounded transcript, so reloads and new visits reset it; no durable conversation storage is added.

## Guardrails

Portfolio mode retains the existing citation validator and exact insufficient-evidence behavior. The model's mode is a proposal: deterministic question and follow-up checks can promote an ambiguous turn to portfolio mode, and completed social/general output is rejected if it refers to Bradley, portfolio entities, or another mode marker. Social/general output is buffered until provider completion, so partial answers cannot advance visit state. The provider remains one turn with no tools or handoffs, medium reasoning, a 3,000-token output ceiling, `store: false`, and tracing disabled.
