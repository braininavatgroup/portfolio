// What the feedback widget and the Worker's feedback ledger share: the shape
// of a note and the reviewer codes a template leaves unedited. The widget runs
// in the browser, so this lives in lib/ rather than worker/.

/** A selected run of text, with a little context so an agent can find the exact run. */
export type FeedbackQuote = {
  text: string;
  prefix?: string;
  suffix?: string;
};

export type FeedbackTarget = {
  selector: string;
  component?: string;
  text?: string;
  rect?: { x: number; y: number; width: number; height: number };
  offset?: { x: number; y: number };
  quote?: FeedbackQuote;
};

export type FeedbackNoteInput = {
  reviewer: string;
  /** What the reviewer typed when their link carried a placeholder code. */
  reviewerName?: string;
  path: string;
  /** May be empty when `suggestion` carries the feedback. */
  note: string;
  /** A replacement for `target.quote.text`, in suggesting mode. */
  suggestion?: string;
  pageTitle?: string;
  target?: FeedbackTarget;
  viewport?: { width: number; height: number };
  userAgent?: string;
};

export type FeedbackNote = FeedbackNoteInput & {
  id: string;
  createdAt: number;
};

/**
 * Codes a link ends up with when a message template was sent unedited
 * (`?r=[name]`, `?r=<code>`). Such a link still works, but the widget asks the
 * reviewer for their name so the digest can tell people apart.
 */
const PLACEHOLDER_REVIEWER_CODES = new Set([
  "name",
  "your-name",
  "yourname",
  "first-name",
  "firstname",
  "their-name",
  "code",
  "reviewer",
  "reviewer-code",
  "person",
  "guest",
]);

export function isPlaceholderReviewerCode(code: string) {
  return PLACEHOLDER_REVIEWER_CODES.has(code);
}
