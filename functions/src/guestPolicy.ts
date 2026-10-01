import { consentWording, legalVersions } from "./legal.js";
// Handbook §5.3. Byte limits are provisional development limits: GC-02.
export const guestPolicy = {
  maxPhotos: 10, maxImageBytes: 5 * 1024 * 1024, maxPostBytes: 25 * 1024 * 1024,
  maxMessage: 1200, maxFeedback: 1200, maxPixels: 40_000_000,
  // Natural Language moderateText confidence at which private feedback is held
  // for the safety team instead of delivered. Categories not listed, including
  // Toxic, Insult and Profanity, are always delivered.
  feedbackHold: { "Violent": 0.8, "Sexual": 0.8, "Derogatory": 0.8, "Firearms & Weapons": 0.8 },
  feedbackReviewDays: 30,
  consentVersion: legalVersions.consent,
  consentWording
} as const;

export const pendingMessage = "Memory added! Your host is reviewing this post to add it to the public wall.";
export const feedbackSentMessage = "Thanks — your feedback has been sent to your host.";
export const feedbackBoundary = "It isn’t monitored in real time and your host can’t reply here — for help during your stay, message them through your booking app. Messages are checked automatically; ones containing threats, sexual content or hate may be held for a safety review first.";
