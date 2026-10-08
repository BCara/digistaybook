import { applicationDefault } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { guestPolicy } from "./guestPolicy.js";
import { scanMemoryPhoto, type SafeSearchResult } from "./visionScreening.js";
import { reserveScreeningAttempt } from "./screeningBudget.js";
import { screeningDiagnostic } from "./screeningDiagnostics.js";
import { localScenario, localTestEnabled } from "./localTest.js";

export type ScreeningResult = { outcome: "clear" | "standard" | "critical" | "reject" | "unavailable"; categories?: string[] };
export type ScreeningInput = { message: string; photos: { bucket: string; path: string }[] };
export type Screener = (input: ScreeningInput) => Promise<ScreeningResult>;

// C-12 selects Google Vision's EU endpoint for photos (visionScreening.ts) and
// the Australia Natural Language endpoint for wall text. The 0.8 text and
// LIKELY/VERY_LIKELY image holds are provisional C-13 engineering mappings:
// non-safety flags hold for host review. Serious text categories use the same
// restricted safety thresholds as private feedback. Nothing is auto-rejected.
const memoryTextHoldThreshold = 0.8;
const imageReviewLikelihoods = new Set(["LIKELY", "VERY_LIKELY"]);
const imageReviewCategories = ["adult", "medical", "violence", "racy"] as const;

export function memoryImageNeedsReview(photos: SafeSearchResult[]): boolean {
  return photos.some(photo => imageReviewCategories.some(category => imageReviewLikelihoods.has(photo[category])));
}

export function memoryImageVerdict(photos: SafeSearchResult[]): ScreeningResult {
  const serious = ["adult", "violence"] as const;
  const categories = serious.filter(category => photos.some(photo => imageReviewLikelihoods.has(photo[category])))
    .map(category => `Photo ${category}`);
  return categories.length ? { outcome: "critical", categories }
    : { outcome: memoryImageNeedsReview(photos) ? "standard" : "clear" };
}

export function memoryTextNeedsReview(categories: { name?: string; confidence?: number }[]): boolean {
  return categories.some(category => (category.confidence ?? 0) >= memoryTextHoldThreshold);
}

async function moderateText(text: string): Promise<{ name?: string; confidence?: number }[]> {
  const started = Date.now();
  const { access_token } = await applicationDefault().getAccessToken();
  if (!access_token) throw new Error("Missing screening credentials");
  const response = await fetch("https://au-language.googleapis.com/v2/documents:moderateText", {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ document: { type: "PLAIN_TEXT", content: text } })
  });
  if (!response.ok) throw new Error(`moderateText ${response.status}`);
  const body = await response.json() as { moderationCategories?: { name?: string; confidence?: number }[] };
  if (!Array.isArray(body.moderationCategories) || !body.moderationCategories.every(category =>
    typeof category.name === "string" && /^[A-Za-z &-]{1,80}$/.test(category.name)
    && typeof category.confidence === "number" && Number.isFinite(category.confidence) && category.confidence >= 0 && category.confidence <= 1)) {
    throw new Error("Incomplete text moderation response");
  }
  const categories = body.moderationCategories.map(category => ({ name: category.name!, confidence: category.confidence! }));
  screeningDiagnostic("screening_text_result", { provider: "google_natural_language", endpointRegion: "au", durationMs: Date.now() - started, categories });
  return categories;
}

export function memoryTextVerdict(categories: { name?: string; confidence?: number }[]): ScreeningResult {
  const safety = feedbackVerdict(categories);
  if (safety.verdict === "critical") return { outcome: "critical", categories: safety.categories };
  return { outcome: memoryTextNeedsReview(categories) ? "standard" : "clear" };
}

async function screenMemoryText(message: string): Promise<ScreeningResult> {
  return message ? memoryTextVerdict(await moderateText(message)) : { outcome: "clear" };
}

async function screenMemoryPhotos(photos: ScreeningInput["photos"]): Promise<ScreeningResult> {
  const results: SafeSearchResult[] = [];
  for (const [photoIndex, photo] of photos.entries()) {
    const started = Date.now();
    const [bytes] = await getStorage().bucket(photo.bucket).file(photo.path).download();
    const categories = await scanMemoryPhoto(bytes);
    results.push(categories);
    screeningDiagnostic("screening_photo_result", { provider: "google_vision", endpointRegion: "eu", photoIndex, durationMs: Date.now() - started, categories });
  }
  return memoryImageVerdict(results);
}

export const screenContent: Screener = async input => {
  if (localTestEnabled()) {
    const outcome = localScenario(input.message);
    return outcome === "critical" ? { outcome, categories: ["Local test safety fixture"] } : { outcome };
  }
  // The emulator has no Google credentials; tests inject a screener instead.
  if (process.env.FUNCTIONS_EMULATOR === "true") return { outcome: "unavailable" };
  await reserveScreeningAttempt("memory", input.message, input.photos.length);
  const [textResult, imageResult] = await Promise.all([
    screenMemoryText(input.message),
    screenMemoryPhotos(input.photos)
  ]);
  const categories = [...(textResult.categories ?? []), ...(imageResult.categories ?? [])];
  const result: ScreeningResult = textResult.outcome === "critical" || imageResult.outcome === "critical" ? { outcome: "critical", categories }
    : { outcome: textResult.outcome === "standard" || imageResult.outcome === "standard" ? "standard" : "clear" };
  screeningDiagnostic("screening_provider_decision", { outcome: result.outcome, textFlagged: textResult.outcome !== "clear", imageFlagged: imageResult.outcome !== "clear",
    textHoldThreshold: memoryTextHoldThreshold, safetyHoldThresholds: guestPolicy.feedbackHold, imageHoldLikelihoods: [...imageReviewLikelihoods] });
  return result;
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
// trigger serious safety categories is held for the safety team. An unavailable
// scan waits privately for retry before any delivery to the Host.
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
  if (localTestEnabled()) {
    const scenario = localScenario(text);
    if (scenario === "unavailable") throw new Error("Local test provider outage");
    return scenario === "critical" ? { verdict: "critical", categories: ["Local test safety fixture"] } : { verdict: "deliver" };
  }
  // The emulator has no Google credentials; tests inject a screener instead.
  if (process.env.FUNCTIONS_EMULATOR === "true") return { verdict: "deliver" };
  await reserveScreeningAttempt("feedback", text);
  // Text moderation supports an Australia endpoint. Keep private feedback in
  // that location instead of silently using Google's global endpoint.
  const result = feedbackVerdict(await moderateText(text));
  screeningDiagnostic("screening_feedback_decision", { outcome: result.verdict, thresholds: guestPolicy.feedbackHold });
  return result;
};
