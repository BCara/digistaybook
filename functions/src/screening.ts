import { applicationDefault } from "firebase-admin/app";
import { guestPolicy } from "./guestPolicy.js";

export type ScreeningResult = { outcome: "clear" | "standard" | "critical" | "reject" | "unavailable" };
export type ScreeningInput = { message: string; photos: { bucket: string; path: string }[] };
export type Screener = (input: ScreeningInput) => Promise<ScreeningResult>;

// No provider is selected in handbook C-12/C-13. Never substitute profanity
// matching or a host's approval for the required image AND text screening.
export const screenContent: Screener = async () => ({ outcome: "unavailable" });

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
  const response = await fetch("https://language.googleapis.com/v2/documents:moderateText", {
    method: "POST", signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ document: { type: "PLAIN_TEXT", content: text } })
  });
  if (!response.ok) throw new Error(`moderateText ${response.status}`);
  const body = await response.json() as { moderationCategories?: { name?: string; confidence?: number }[] };
  return feedbackVerdict(body.moderationCategories ?? []);
};
