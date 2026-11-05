import { render, screen } from "@testing-library/react";
import { BlogIndexPage, BlogPostPage } from "./BlogPage";
import { blogPosts } from "../../domain/blog";

const comparison = blogPosts.find(post => post.slug === "digistaybook-vs-touch-stay-hostfully-staypage")!;

describe("blog pages", () => {
  it("opens a draft in a dev build, marked as a draft", () => {
    render(<BlogPostPage slug={comparison.slug} />);
    expect(screen.getByRole("heading", { level: 1, name: comparison.title })).toBeInTheDocument();
    expect(screen.getByText("Draft for review.")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("keeps marketing's rules in the post: no currency, and links that point at real pages", () => {
    const { container } = render(<BlogPostPage slug={comparison.slug} />);
    expect(container.textContent).not.toMatch(/[$€£¥]|\b(USD|AUD|NZD|CAD|GBP|EUR)\b/);
    const hrefs = [...container.querySelectorAll("a")].map(link => link.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/pricing", "/stay/demo-cottage", "/qr-sign-maker"]));
  });

  it("is a 404 for a post that doesn't exist", () => {
    render(<BlogPostPage slug="no-such-post" />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("lists the posts a reader may open", () => {
    render(<BlogIndexPage />);
    expect(screen.getByRole("link", { name: comparison.title })).toHaveAttribute("href", `/blog/${comparison.slug}`);
  });
});
