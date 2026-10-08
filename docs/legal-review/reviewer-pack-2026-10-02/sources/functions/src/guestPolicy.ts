import { consentWording, legalVersions } from "./legal.js";
// Handbook §5.3. Byte limits are provisional development limits: GC-02.
export const guestPolicy = {
  maxPhotos: 10, maxImageBytes: 5 * 1024 * 1024, maxPostBytes: 25 * 1024 * 1024,
  maxMessage: 1200, maxFeedback: 1200, maxPixels: 40_000_000,
  // Shared serious-text thresholds for memories and private feedback. Categories
  // not listed, including Toxic, Insult and Profanity, do not alone open a safety
  // case: memories go to host review; private feedback reaches the host inbox.
  feedbackHold: { "Violent": 0.8, "Sexual": 0.8, "Derogatory": 0.8, "Firearms & Weapons": 0.8 },
  feedbackReviewDays: 30,
  consentVersion: legalVersions.consent,
  consentWording
} as const;

export const pendingMessage = "Your memory has been saved for review before it can appear on the public wall.";
export const feedbackSentMessage = "Thanks — your feedback has been sent to your host.";
export const feedbackBoundary = "It isn’t monitored in real time and your host can’t reply here — for help during your stay, message them through your booking app. Messages are checked automatically; ones containing threats, sexual content or hate may be held for a safety review first.";
