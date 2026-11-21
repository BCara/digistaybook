/**
 * The blog's posts, as the router, the sitemap and the prerender step see them.
 *
 * Marketing drafts every post for the owners' review first
 * (marketing/campaigns/…/BLOG_POST.md), so a post starts here as a "draft":
 * it renders in a local dev build for review, and stays out of the production
 * build, the sitemap and search. Approval is one edit, `status: "published"`,
 * then a build and deploy. The bodies live in `ui/blog/posts.tsx`, keyed by slug.
 */
export type BlogStatus = "draft" | "published";

export type BlogPostMeta = {
  slug: string;
  /** The page's own heading. */
  title: string;
  /** What a search result and a link preview show; at most about 60 characters. */
  seoTitle: string;
  /** The meta description; at most about 155 characters. */
  description: string;
  /** "2026-11-01". The date the post's facts were last checked, shown on the post. */
  date: string;
  status: BlogStatus;
};

export const blogPosts: readonly BlogPostMeta[] = [
  {
    slug: "digistaybook-vs-touch-stay-hostfully-staypage",
    title: "Paper guestbook, digital guidebook or guest journal? An honest comparison for vacation rental hosts",
    seoTitle: "Digital Guestbook vs. Guidebook vs. Paper: Hosts' Comparison",
    description: "Paper guestbooks, digital guidebooks and guest journals for vacation rentals, compared feature by feature: Touch Stay, Hostfully, StayPage and DigiStayBook.",
    date: "2026-11-01",
    status: "draft"
  }
];

export const blogPath = (slug: string) => `/blog/${slug}`;

/** The posts a reader may open: published ones, plus drafts in a dev build. */
export function readablePosts(includeDrafts: boolean = import.meta.env.DEV): BlogPostMeta[] {
  return blogPosts.filter(post => post.status === "published" || includeDrafts);
}

export function findPost(slug: string, includeDrafts: boolean = import.meta.env.DEV): BlogPostMeta | null {
  return readablePosts(includeDrafts).find(post => post.slug === slug) ?? null;
}

/** The blog's indexed addresses: none until a post is published, then the index and each published post. */
export function blogIndexedPaths(): string[] {
  const published = readablePosts(false);
  return published.length ? ["/blog", ...published.map(post => blogPath(post.slug))] : [];
}

/** "November 1, 2026", the US way, whatever the reader's locale. */
export function blogDateLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
