import { applySeo, indexedPaths, pageSeo, prerenderedPaths, seoHeadMarkup, SITE_ORIGIN } from "./seo";

describe("search indexing boundaries", () => {
  it.each(["/stay/demo-cottage", "/wall/demo-cottage"])("indexes and prerenders the public demo at %s", path => {
    expect(indexedPaths).toContain(path);
    expect(prerenderedPaths).toContain(path);
    const seo = pageSeo(path);
    expect(seo.canonical).toBe(path);
    expect(seoHeadMarkup(seo)).toContain(`href="${SITE_ORIGIN}${path}"`);
    expect(seoHeadMarkup(seo)).not.toContain("noindex");
  });

  it.each([
    "/host/sign-in", "/host/sign-up", "/operations", "/reset-password", "/verify-email",
    "/stay/real-property", "/stay/real-property/secret-token", "/wall/real-property",
    "/embed/wall/demo-cottage", "/stay/demo-cottage/secret-token", "/stay/demo-cottage-other"
  ])("keeps the non-marketing route %s out of search", path => {
    expect(pageSeo(path).canonical).toBeNull();
    expect(seoHeadMarkup(pageSeo(path))).toContain('name="robots" content="noindex"');
    expect(indexedPaths).not.toContain(path);
  });

  it("removes a private page's noindex when navigating to the public demo and restores it on leaving", () => {
    const originalHead = document.head.innerHTML;
    try {
      applySeo(pageSeo("/host/sign-in"));
      expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex");
      applySeo(pageSeo("/stay/demo-cottage"));
      expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute("href", `${SITE_ORIGIN}/stay/demo-cottage`);
      applySeo(pageSeo("/stay/real-property/secret-token"));
      expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex");
      expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    } finally {
      document.head.innerHTML = originalHead;
    }
  });
});
