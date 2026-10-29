export const postMvpFeatures = {
  affiliateReferralEngine: false,
  contextualWritingPrompts: false,
  dualCarouselTabletDisplay: false,
  directBookingLinks: true,
  clientAutoTranslation: false
} as const;

export type PostMvpFeature = keyof typeof postMvpFeatures;

export function isPostMvpFeatureEnabled(feature: PostMvpFeature): boolean {
  return postMvpFeatures[feature];
}
