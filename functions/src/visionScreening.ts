import { applicationDefault } from "firebase-admin/app";
import { guestPolicy } from "./guestPolicy.js";

// C-12, owner decision 2 October 2026. Use the documented EU SafeSearch
// endpoint directly; never fall back to Google's global or US endpoint.
// Google's contractual Vision residency list currently covers OCR only.
export const visionScreening = {
  region: "eu",
  origin: "https://eu-vision.googleapis.com",
  feature: "SAFE_SEARCH_DETECTION",
  mode: "synchronous",
  timeoutMs: 10_000
} as const;

const likelihoods = ["VERY_UNLIKELY", "UNLIKELY", "POSSIBLE", "LIKELY", "VERY_LIKELY"] as const;
type Likelihood = typeof likelihoods[number];
const categories = ["adult", "spoof", "medical", "violence", "racy"] as const;
export type SafeSearchResult = Record<typeof categories[number], Likelihood>;

// Transport only: results cannot publish a memory until C-13 mappings and
// cost controls are approved and the combined image/text adapter is wired.
// Supply the already transformed, metadata-stripped photo from Sydney storage.
// One image per request keeps the current 5 MiB limit below Vision's JSON cap.
export async function scanMemoryPhoto(image: Buffer): Promise<SafeSearchResult> {
  if (!image.length || image.length > guestPolicy.maxImageBytes) throw new Error("Invalid screening image size");
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) throw new Error("Missing screening project");
  const { access_token } = await applicationDefault().getAccessToken();
  if (!access_token) throw new Error("Missing screening credentials");
  const response = await fetch(`${visionScreening.origin}/v1/projects/${projectId}/locations/${visionScreening.region}/images:annotate`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(visionScreening.timeoutMs),
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ image: { content: image.toString("base64") },
      features: [{ type: visionScreening.feature }] }] })
  });
  // Error text deliberately excludes image bytes, tokens and provider bodies.
  if (!response.ok) throw new Error(`SafeSearch HTTP ${response.status}`);
  const body = await response.json() as { responses?: { error?: unknown; safeSearchAnnotation?: Record<string, unknown> }[] };
  const result = body.responses?.[0];
  if (body.responses?.length !== 1 || !result || result.error || !result.safeSearchAnnotation) throw new Error("Incomplete SafeSearch response");
  const annotation = result.safeSearchAnnotation;
  if (!categories.every(category => likelihoods.includes(annotation[category] as Likelihood))) throw new Error("Unknown SafeSearch likelihood");
  return Object.fromEntries(categories.map(category => [category, annotation[category]])) as SafeSearchResult;
}
