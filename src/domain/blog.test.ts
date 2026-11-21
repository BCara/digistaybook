import { blogDateLabel, blogIndexedPaths, blogPath, blogPosts, findPost, readablePosts } from "./blog";
import { indexedPaths, pageSeo, prerenderedPaths, seoHeadMarkup } from "../seo";
import { postBodies } from "../ui/blog/posts";

describe("blog posts", () => {
  it("gives every post a body, a unique slug and search text that fits a result", () => {
    expect(new Set(blogPosts.map(post => post.slug)).size).toBe(blogPosts.length);
    for (const post of blogPosts) {
      expect(postBodies[post.slug]).toBeTypeOf("function");
      expect(post.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(post.seoTitle.length).toBeLessThanOrEqual(60);
      expect(post.description.length).toBeLessThanOrEqual(160);
      expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("keeps a draft out of the production build, the sitemap and search", () => {
    for (const post of blogPosts.filter(entry => entry.status === "draft")) {
      const path = blogPath(post.slug);
      expect(findPost(post.slug, false)).toBeNull();
      expect(blogIndexedPaths()).not.toContain(path);
      expect(indexedPaths).not.toContain(path);
      expect(prerenderedPaths).not.toContain(path);
      expect(seoHeadMarkup(pageSeo(path))).toContain('name="robots" content="noindex"');
      // A dev build still opens it, for review.
      expect(findPost(post.slug, true)).toEqual(post);
    }
  });

  it("lists the blog index only once something is published", () => {
    const published = readablePosts(false);
    expect(indexedPaths.includes("/blog")).toBe(published.length > 0);
    for (const post of published) {
      expect(indexedPaths).toContain(blogPath(post.slug));
      expect(pageSeo(blogPath(post.slug)).canonical).toBe(blogPath(post.slug));
    }
  });

  it("dates posts the US way", () => {
    expect(blogDateLabel("2026-11-01")).toBe("November 1, 2026");
  });
});
