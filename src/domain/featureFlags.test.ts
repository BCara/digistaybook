import { isPostMvpFeatureEnabled, postMvpFeatures } from "./featureFlags";

describe("post-MVP feature flags", () => {
  it("keeps every future feature disabled until it is built", () => {
    // Direct booking links shipped on 29 October 2026 as the Host's own
    // "Stay with us again" links on the in-stay wall (src/domain/stayAgain.ts).
    expect(isPostMvpFeatureEnabled("directBookingLinks")).toBe(true);
    const { directBookingLinks: _shipped, ...future } = postMvpFeatures;
    expect(Object.values(future)).toEqual([false, false, false, false]);
  });
});
