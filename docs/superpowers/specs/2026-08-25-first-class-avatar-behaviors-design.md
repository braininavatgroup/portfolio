# First-class avatar behaviors design

**Ticket:** PER-15

## Goal

Make every animation Bradley supplied available as a named portfolio behavior, let the existing portfolio agent choose those behaviors as part of each answer, and remove guessed semantic aliases and missing-clip fallbacks.

The exact Meshy GLB remains the visible model. A separate GLB preserves selected native motion clips without replacing the Meshy mesh, materials, clothes, glasses, or geometry.

## Product decisions

- All 20 clips embedded in Bradley's Meshy GLB are first-class behaviors.
- One registry is the source of truth for the normalized behavior ID, exact GLB clip name, display label, agent guidance, and playback hold time.
- A behavior has exactly one clip. There are no clip aliases, fallback chains, or guessed substitutions.
- Every successful agent answer selects between one and three behaviors. A normal answer should choose one. Two or three are for an explicitly requested performance or a response whose progression genuinely benefits from a sequence.
- The renderer may suppress decorative playback when the visitor has requested reduced motion or when the avatar renderer is unavailable. That accessibility and containment policy does not change the agent's selected behavior.
- Every lifecycle state has one explicit registered behavior. A missing configured state behavior is an asset error, not a reason to select another clip.
- The development controls list every registered behavior by its readable label and normalized ID.
- The model chooses behavior from semantic descriptions and restraint rules. The application does not implement a keyword-to-animation lookup table.

## Behavior registry

`lib/avatar/behaviors.ts` owns the immutable registry. `AllowedAnimation` becomes the union of its normalized IDs. Each normalized ID maps one-to-one to the exact source clip listed below.

| Behavior ID | Exact clip | Agent meaning |
| --- | --- | --- |
| `agree_gesture` | `Agree_Gesture` | Conversational agreement, acknowledgment, or a calm affirmative answer |
| `alert` | `Alert` | Sudden attention, discovery, or an important warning |
| `angry_to_tantrum_sit` | `Angry_To_Tantrum_Sit` | Comedic frustration or an explicitly requested dramatic reaction |
| `big_wave_hello` | `Big_Wave_Hello` | An enthusiastic greeting or farewell |
| `cheer_with_both_hands_1` | `Cheer_with_Both_Hands_1` | A strong celebration for a meaningful success |
| `cheer_with_both_hands` | `Cheer_with_Both_Hands` | A lighter celebration or congratulations |
| `formal_bow` | `Formal_Bow` | Respectful thanks, an introduction, or a formal sign-off |
| `groan_holding_stomach_in_sleep` | `Groan_Holding_Stomach_in_Sleep` | Comedic exhaustion, discomfort, or a requested exaggerated reaction |
| `idle_3` | `Idle_3` | Quiet presence when a restrained response is appropriate |
| `indoor_play` | `Indoor_Play` | Playful activity or hands-on exploration |
| `joyful_dance_with_hand_sway` | `Joyful_Dance_with_Hand_Sway` | Relaxed delight, music, or a playful positive response |
| `prone_reach_help` | `Prone_Reach_Help` | An explicitly dramatic plea or slapstick request for help |
| `running` | `Running` | Urgency, momentum, or going somewhere quickly |
| `shrug` | `Shrug` | Uncertainty, not knowing, or a light "it depends" answer |
| `sneaky_walk` | `Sneaky_Walk` | Mischief, secrecy, or a playful reveal |
| `swim_forward` | `Swim_Forward` | Swimming, forward effort, or an explicitly aquatic joke |
| `wake_up_and_look_up` | `Wake_Up_and_Look_Up` | Thinking, remembering, noticing, or becoming curious |
| `walking` | `Walking` | A calm entrance, exit, or movement toward something |
| `wave_one_hand` | `Wave_One_Hand` | A casual greeting, acknowledgment, or sign-off |
| `swimming_to_edge` | `swimming_to_edge` | Reaching the end of a swim or an explicitly aquatic transition |

The descriptions guide selection without hiding any behavior. Dramatic distress motions remain available but should appear only when the visitor requests that tone or the answer clearly earns it.

The default hold between sequence entries is 1,600 milliseconds. `walking` and `running` use 1,200 milliseconds. `big_wave_hello` and `formal_bow` use 2,200 milliseconds. `joyful_dance_with_hand_sway` uses 2,800 milliseconds. These bounded presentation windows keep a multi-step performance visible without forcing the chat to wait through an entire source clip.

## Lifecycle mapping

The controller uses this exact state map:

| Avatar state | Behavior |
| --- | --- |
| `hidden` | `idle_3` |
| `entering` | `walking` |
| `idle` | `idle_3` |
| `listening` | `alert` |
| `thinking` | `wake_up_and_look_up` |
| `tool_use` | `indoor_play` |
| `talking` | `agree_gesture` |
| `success` | `cheer_with_both_hands` |
| `confused` | `shrug` |
| `error` | `groan_holding_stomach_in_sleep` |
| `exiting` | `walking` |

State changes resolve by direct lookup. Loading an asset that does not contain the configured behavior marks the avatar renderer failed and leaves chat usable. It never changes the state to `idle_3` or another available clip.

## Agent contract

The existing `@openai/agents` agent remains the only agent. No behavior-selection tool and no second agent are added.

The stable behavior catalog is generated from the registry and appended to the agent's static instructions. The installed Agents SDK supports both static and dynamic instructions, but the behavior catalog does not depend on request-time data. Static instructions are therefore the smaller and less error-prone choice. OpenAI's agent guidance describes instructions as the place for an agent's job and constraints, and recommends dynamic instructions only when guidance depends on runtime context: <https://developers.openai.com/api/docs/guides/agents/define-agents>.

The existing Zod `outputType` expands to include a required non-empty behavior sequence:

```ts
type PortfolioAgentOutput = {
  mode: "portfolio" | "social" | "general";
  sentences: Array<{ text: string; evidenceIds: string[] }>;
  avatarSequence: [AllowedAnimation, ...AllowedAnimation[]];
};
```

The Zod array has a minimum of one and a maximum of three entries. Each entry uses an enum generated from the registry. Structured Outputs are appropriate because the application consumes this as typed control data, and OpenAI recommends them over JSON mode when schema adherence matters: <https://developers.openai.com/api/docs/guides/structured-outputs>.

The agent instructions say:

- choose exactly one behavior for an ordinary answer;
- choose two or three only for a requested performance or a meaningful emotional progression;
- match the answer's social and emotional intent, not isolated keywords;
- use `idle_3` when restraint is the best performance, rather than omitting behavior;
- reserve distress, prone, swimming, running, and large dances for contexts that support them;
- never mention the behavior choice in the answer unless the visitor asks about it.

This gives the agent freedom inside an exact, finite vocabulary. It does not encode "greeting means wave" as application logic.

## Data flow

1. The provider sends the question, portfolio evidence, conversation, and the static behavior catalog to the existing agent.
2. The Agents SDK validates the final response against the Zod output type.
3. The provider renders and yields the answer text through the existing evidence-validation path.
4. The provider reports the validated behavior IDs through a typed `onEffects` callback.
5. The chat handler stores those effects while validating the answer. It emits one `effects` event only after at least one valid answer delta, followed by `done`.
6. The handler expands each behavior ID to `play` plus a registry-owned bounded hold time, except that the last behavior does not need a trailing wait.
7. The existing client parser validates the event again. `PortfolioChat` queues it behind the first rendered answer text, and the existing sequence runner cancels stale sequences when a new turn starts.
8. The controller plays each exact registered clip. On completion, the normal chat lifecycle returns to the explicit `idle_3` state behavior.

The model does not receive selectors, URLs, Three.js objects, bone names, arbitrary transforms, or arbitrary delay values. This change emits no model-selected site actions.

## Asset and runtime validation

The avatar build checks the union of clip names in the exact Meshy GLB and the motion-only GLB. It fails when:

- a registry clip is absent;
- two registry entries share an ID or clip name;
- a state mapping references an unregistered behavior;
- the exact Meshy source and public Meshy GLB differ.

At runtime, `AvatarAssetAdapter` renders only `model.scene` from the exact Meshy GLB. It can read animations from the motion-library GLB but never mounts `motionLibrary.scene`. Native Meshy clips win when both files contain the same clip name. The adapter reports the registered behaviors whose exact clips loaded. The controller treats any configured-but-unavailable behavior as an avatar failure. Chat and the rest of the portfolio remain available because the avatar has its own error boundary.

## Development controls

The `avatarDebug=1` panel displays all 20 behaviors from the registry. Each button shows a readable label and exposes the normalized ID for inspection. Clicking a button plays that exact clip. The panel does not divide clips into mapped and raw groups because every clip is mapped.

Lifecycle state buttons remain available and exercise the exact state map. The current model and motion-library asset URLs remain visible through configuration and do not alter the GLB bytes.

## Error handling

- A model response with zero behaviors, more than three behaviors, or an unknown behavior fails structured-output validation. No unvalidated effect reaches the browser.
- If answer validation fails, the handler does not emit the otherwise valid behavior sequence.
- If effect parsing fails in the browser, the text answer remains visible and no avatar command runs.
- Starting another turn cancels pending waits and commands from the prior turn.
- Reduced-motion preference suppresses decorative `play` and `wait` commands while keeping required site behavior and a stable avatar pose.
- Missing clips fail the build. An unexpected runtime mismatch fails only the avatar renderer.

## Tests and proof

Durable tests cover:

- all 20 unique behavior IDs and their exact one-to-one clip names;
- build-time presence of every registry clip across the exact model and motion library;
- exact lifecycle-state lookup with no fallback behavior;
- rejection of unknown behavior IDs and unavailable configured clips;
- all 20 buttons in the development controls;
- provider structured output with a required one-to-three behavior sequence;
- provider-to-handler effect delivery after validated answer text and before `done`;
- no effects after an invalid or empty answer;
- client validation, stale-turn cancellation, and reduced-motion suppression;
- exact Meshy source/public hash equality and proof that the external library's scene is never rendered;
- a production build whose client chunks contain no development-control labels.

Rendered verification uses the existing workspace server. It captures the exact Meshy avatar playing native Meshy behaviors. It also checks the full development behavior list, desktop and mobile placement, reduced motion, and avatar-only renderer containment. Software WebGL is smoke evidence; Bradley's final motion and visual judgment remains the acceptance walk.

## Scope

This design changes avatar behavior naming, state mapping, agent output, effect delivery, development controls, asset validation, and their tests. It does not add model-selected project navigation, change the visible Meshy asset, edit Bradley's clothes or glasses, download another avatar, change chat topic modes, deploy the site, or activate production capability.

## Recorded assumptions

- Bradley's statement that the agent should perform motion most of the time means every successful agent answer must select at least one behavior. `idle_3` is the intentionally restrained choice.
- The 20 current clips are the complete behavior catalog for this ticket. Adding another source clip later means adding one registry entry and satisfying the same asset checks.
- The normalized IDs above are mechanical snake-case forms of the exact clip names. They are stable application identifiers, not semantic aliases.
- The exact lifecycle map is a reversible default derived from the clip names and can be judged in the final behavior walk.
