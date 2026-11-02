import { blogPath, blogPosts, findBlogPost, formatBlogDate, inlineText, parseInline, parseMarkdown, type Block } from "./blog";
import { indexedPaths, pageSeo, prerenderedPaths } from "../seo";

const allText = (blocks: Block[]) => blocks.map(block => {
  switch (block.kind) {
    case "heading":
    case "paragraph": return inlineText(block.text);
    case "list": return block.items.map(inlineText).join("\n");
    case "table": return [...block.header, ...block.rows.flat()].map(inlineText).join("\n");
    case "rule": return "";
  }
}).join("\n");

describe("blog markdown", () => {
  it("reads headings, lists, tables and inline marks", () => {
    const blocks = parseMarkdown([
      "# Title", "", "Some **bold** and *italic* with a [link](/pricing).", "",
      "- one", "- two", "", "| | A | B |", "|---|---|---|", "| **Row** | yes | no |", "", "---"
    ].join("\n"));
    expect(blocks.map(block => block.kind)).toEqual(["heading", "paragraph", "list", "table", "rule"]);
    const table = blocks[3];
    expect(table.kind === "table" && table.rows[0].map(inlineText)).toEqual(["Row", "yes", "no"]);
  });

  it("keeps a question and its answer as one paragraph with a break", () => {
    const [block] = parseMarkdown("**Question?**\nAnswer.");
    expect(block.kind).toBe("paragraph");
    expect(block.kind === "paragraph" && inlineText(block.text)).toBe("Question?\nAnswer.");
  });

  it("drops links that are not our own paths or https", () => {
    expect(parseInline("[bad](javascript:alert(1))")).toEqual([{ kind: "text", text: "bad" }, { kind: "text", text: ")" }]);
    expect(parseInline("[ok](https://example.com)")[0]).toMatchObject({ kind: "link", href: "https://example.com" });
    expect(parseInline("[ok](//evil.example)")[0]).toEqual({ kind: "text", text: "ok" });
  });

  it("formats the published date in US English", () => {
    expect(formatBlogDate("2026-11-02")).toBe("November 2, 2026");
  });
});

describe("blog posts", () => {
  it.each(blogPosts.map(post => [post.slug, post] as const))("%s has one title and is indexed", (_slug, post) => {
    const blocks = parseMarkdown(post.markdown);
    expect(blocks.filter(block => block.kind === "heading" && block.level === 1)).toHaveLength(1);
    expect(findBlogPost(blogPath(post))).toBe(post);
    expect(indexedPaths).toContain(blogPath(post));
    expect(prerenderedPaths).toContain(blogPath(post));
    expect(pageSeo(blogPath(post)).canonical).toBe(blogPath(post));
    expect(post.description.length).toBeLessThanOrEqual(160);
  });

  // Marketing guardrail: posts link to /pricing and never quote a price or a currency.
  it.each(blogPosts.map(post => [post.slug, post] as const))("%s quotes no prices or currencies", (_slug, post) => {
    const text = allText(parseMarkdown(post.markdown));
    expect(text).not.toMatch(/[$€£¥]|\b(USD|AUD|EUR|GBP|NZD|CAD|currency|currencies)\b|\d+[.,]\d{2}\b/i);
  });

  it("indexes the blog list but not an unknown post", () => {
    expect(indexedPaths).toContain("/blog");
    expect(findBlogPost("/blog/not-a-post")).toBeUndefined();
    expect(pageSeo("/blog/not-a-post").canonical).toBeNull();
  });
});
