import { applicationDefault } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { guestPolicy } from "./guestPolicy.js";
import { scanMemoryPhoto, type SafeSearchResult } from "./visionScreening.js";

export type ScreeningResult = { outcome: "clear" | "standard" | "critical" | "reject" | "unavailable" };
export type ScreeningInput = { message: string; photos: { bucket: string; path: string }[] };
export type Screener = (input: ScreeningInput) => Promise<ScreeningResult>;

// C-12 selects Google Vision's EU endpoint for photos (visionScreening.ts) and
// the Australia Natural Language endpoint for wall text. The 0.8 text and
// LIKELY/VERY_LIKELY image holds are provisional C-13 engineering mappings:
// they hold for host review and never reject automatically.
const memoryTextHoldThreshold = 0.8;
const imageReviewLikelihoods = new Set(["LIKELY", "VERY_LIKELY"]);
const imageReviewCategories = ["adult", "medical", "violence", "racy"] as const;

export function memoryImageNeedsReview(photos: SafeSearchResult[]): boolean {
  return photos.some(photo => imageReviewCategories.some(category => imageReviewLikelihoods.has(photo[category])));
}

export function memoryTextNeedsReview(categories: { name?: string; confidence?: number }[]): boolean {
  return categories.some(category => (category.confidence ?? 0) >= memoryTextHoldThreshold);
}

async function moderateText(text: string): Promise<{ name?: string; confidence?: number }[]> {
  const { access_token } = await applicationDefault().getAccessToken();
  if (!access_token) throw new Error("Missing screening credentials");
  const response = await fetch("https://au-language.googleapis.com/v2/documents:moderateText", {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ document: { type: "PLAIN_TEXT", content: text } })
  });
  if (!response.ok) throw new Error(`moderateText ${response.status}`);
  const body = await response.json() as { moderationCategories?: { name?: string; confidence?: number }[] };
  return body.moderationCategories ?? [];
}

async function screenMemoryText(message: string): Promise<boolean> {
  return Boolean(message) && memoryTextNeedsReview(await moderateText(message));
}

async function screenMemoryPhotos(photos: ScreeningInput["photos"]): Promise<boolean> {
  const results: SafeSearchResult[] = [];
  for (const photo of photos) {
    const [bytes] = await getStorage().bucket(photo.bucket).file(photo.path).download();
    results.push(await scanMemoryPhoto(bytes));
  }
  return memoryImageNeedsReview(results);
}

export const screenContent: Screener = async input => {
  // The emulator has no Google credentials; tests inject a screener instead.
  if (process.env.FUNCTIONS_EMULATOR === "true") return { outcome: "unavailable" };
  const [textFlagged, imageFlagged] = await Promise.all([
    screenMemoryText(input.message),
    screenMemoryPhotos(input.photos)
  ]);
  return textFlagged || imageFlagged ? { outcome: "standard" } : { outcome: "clear" };
};

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
  // Text moderation supports an Australia endpoint. Keep private feedback in
  // that location instead of silently using Google's global endpoint.
  return feedbackVerdict(await moderateText(text));
};
