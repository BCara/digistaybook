import { isPostMvpFeatureEnabled, postMvpFeatures } from "./featureFlags";

describe("post-MVP feature flags", () => {
  it("keeps every future feature disabled", () => {
    expect(Object.values(postMvpFeatures)).toEqual([false, false, false, false, false]);
    expect(isPostMvpFeatureEnabled("directBookingLinks")).toBe(false);
  });
});
