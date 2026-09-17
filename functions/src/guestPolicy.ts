// Handbook §5.3. Byte limits are provisional development limits: GC-02.
export const guestPolicy = {
  maxPhotos: 10, maxImageBytes: 5 * 1024 * 1024, maxPostBytes: 25 * 1024 * 1024,
  maxMessage: 1200, maxFeedback: 1200, maxPixels: 40_000_000,
  consentVersion: "handbook-5.3-draft-v1",
  consentWording: "I agree to the Guest Terms and Privacy Policy, consent to this image being displayed publicly, and confirm I am over 16 years of age."
} as const;

export const pendingMessage = "Memory added! Your host is reviewing this post to add it to the public wall.";
export const feedbackBoundary = "Note: This feedback is kept strictly private and will not be published to the public memory wall. It is not monitored in real-time and your host will not reply here; it is strictly used to improve our house manual for future guests. If you need immediate assistance during your stay, please message your host directly through your booking app.";
