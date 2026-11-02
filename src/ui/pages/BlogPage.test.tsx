import { render, screen } from "@testing-library/react";
import { BlogIndexPage, BlogPostPage } from "./BlogPage";
import { blogPosts } from "../../domain/blog";

describe("blog pages", () => {
  it("lists each post with a link to it", () => {
    render(<BlogIndexPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    for (const post of blogPosts) {
      expect(document.querySelector(`a[href="/blog/${post.slug}"]`)).toBeInTheDocument();
    }
  });

  it("renders the comparison post with its table and internal links", () => {
    const post = blogPosts.find(entry => entry.slug === "digistaybook-vs-touch-stay-hostfully-staypage")!;
    render(<BlogPostPage post={post} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/honest comparison for vacation rental hosts/);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Touch Stay" })).toBeInTheDocument();
    for (const href of ["/pricing", "/stay/demo-cottage", "/qr-sign-maker", "/wall/demo-cottage", "/contact", "/privacy"]) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { level: 2, name: "When DigiStayBook isn't the right fit" })).toBeInTheDocument();
  });
});
