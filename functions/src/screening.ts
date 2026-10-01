import { applicationDefault } from "firebase-admin/app";
import { guestPolicy } from "./guestPolicy.js";

export type ScreeningResult = { outcome: "clear" | "standard" | "critical" | "reject" | "unavailable" };
export type ScreeningInput = { message: string; photos: { bucket: string; path: string }[] };
export type Screener = (input: ScreeningInput) => Promise<ScreeningResult>;

// C-12 selects Google Vision's EU endpoint for photos (visionScreening.ts).
// C-13 category mappings and numeric cost controls are still pending. Never
// substitute this transport, text matching or host approval for a complete scan.
export const screenContent: Screener = async () => ({ outcome: "unavailable" });

// A successful provider scan does not by itself make contact details suitable
// for a public guest wall. This rule only adds host review; it never clears an
// unavailable scan or overrides a more severe provider result.
export function memoryNeedsContactReview(message: string): boolean {
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const link = /\b(?:https?:\/\/|www\.)\S+|\b(?:[A-Z0-9-]+\.)+(?:com|net|org|edu|gov|io|co|au|uk|nz)(?:\/\S*)?\b/i;
  const phone = /(?:^|[^\w])(?:\+?\d[\d ().-]{7,}\d)(?=$|[^\w])/;
  return email.test(message) || link.test(message) || phone.test(message);
}

// Private feedback is read by one adult, the Host, and complaints are what it
// is for: rude, negative and profane text is delivered. Only text that would
// harm the Host is held for the safety team, and an unavailable provider
// delivers rather than holds, because holding protects no public audience and
// a held message is a complaint the Host never sees.
export type FeedbackVerdict = { verdict: "deliver" } | { verdict: "critical"; categories: string[] };
export type FeedbackScreener = (text: string) => Promise<FeedbackVerdict>;

export function feedbackVerdict(categories: { name?: string; confidence?: number }[]): FeedbackVerdict {
  const held = categories.filter(category => {
    const threshold = (guestPolicy.feedbackHold as Record<string, number>)[category.name ?? ""];
    return threshold !== undefined && (category.confidence ?? 0) >= threshold;
  }).map(category => category.name!);
  return held.length ? { verdict: "critical", categories: held } : { verdict: "deliver" };
}

export const screenFeedback: FeedbackScreener = async text => {
  // The emulator has no Google credentials; tests inject a screener instead.
  if (process.env.FUNCTIONS_EMULATOR === "true") return { verdict: "deliver" };
  const { access_token } = await applicationDefault().getAccessToken();
  // Text moderation supports an Australia endpoint. Keep private feedback in
  // that location instead of silently using Google's global endpoint.
  const response = await fetch("https://au-language.googleapis.com/v2/documents:moderateText", {
    method: "POST", signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ document: { type: "PLAIN_TEXT", content: text } })
  });
  if (!response.ok) throw new Error(`moderateText ${response.status}`);
  const body = await response.json() as { moderationCategories?: { name?: string; confidence?: number }[] };
  return feedbackVerdict(body.moderationCategories ?? []);
};
