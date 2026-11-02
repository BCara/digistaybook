import { Fragment, type ReactNode } from "react";
import { blogPath, blogPosts, formatBlogDate, parseMarkdown, type Block, type BlogPost, type Inline } from "../../domain/blog";

function renderInline(parts: Inline[]): ReactNode {
  return parts.map((part, index) => {
    switch (part.kind) {
      case "text":
        // A line break inside a paragraph is kept, as the FAQ's question and answer.
        return part.text.split("\n").map((piece, line) => (
          <Fragment key={`${index}-${line}`}>{line > 0 && <br />}{piece}</Fragment>
        ));
      case "strong":
        return <strong key={index}>{renderInline(part.children)}</strong>;
      case "em":
        return <em key={index}>{renderInline(part.children)}</em>;
      case "code":
        return <code key={index}>{part.text}</code>;
      case "link": {
        const external = part.href.startsWith("https://");
        return (
          <a key={index} href={part.href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {renderInline(part.children)}
          </a>
        );
      }
    }
  });
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.kind) {
    case "heading": {
      const Tag = (`h${block.level}`) as "h1" | "h2" | "h3";
      return <Tag key={index}>{renderInline(block.text)}</Tag>;
    }
    case "paragraph":
      return <p key={index}>{renderInline(block.text)}</p>;
    case "list":
      return <ul key={index}>{block.items.map((item, i) => <li key={i}>{renderInline(item)}</li>)}</ul>;
    case "rule":
      return <hr key={index} />;
    case "table":
      return (
        // Wide comparison tables scroll sideways inside their own box on a phone.
        <div key={index} className="blog-table" role="region" aria-label="Comparison table" tabIndex={0}>
          <table>
            <thead>
              <tr>{block.header.map((cell, i) => <th key={i} scope="col">{renderInline(cell)}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, i) => i === 0
                    ? <th key={i} scope="row">{renderInline(cell)}</th>
                    : <td key={i}>{renderInline(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function BlogIndexPage() {
  return (
    <div className="page narrow-page blog-page">
      <p className="eyebrow">Blog</p>
      <h1>Notes for vacation rental hosts</h1>
      <p className="lede">Practical writing on welcoming guests, guidebooks and guestbooks, from the team that makes DigiStayBook.</p>
      <ul className="blog-list">
        {blogPosts.map(post => {
          const title = parseMarkdown(post.markdown).find(block => block.kind === "heading" && block.level === 1);
          return (
            <li key={post.slug}>
              <a href={blogPath(post)}>
                <h2>{title && title.kind === "heading" ? renderInline(title.text) : post.seoTitle}</h2>
              </a>
              <p className="blog-date"><time dateTime={post.published}>{formatBlogDate(post.published)}</time></p>
              <p>{post.description}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BlogPostPage({ post }: { post: BlogPost }) {
  const blocks = parseMarkdown(post.markdown);
  const titleIndex = blocks.findIndex(block => block.kind === "heading" && block.level === 1);
  const title = titleIndex >= 0 ? blocks[titleIndex] : null;
  const body = blocks.filter((_, index) => index !== titleIndex);
  return (
    <article className="page narrow-page blog-page">
      <p className="eyebrow"><a href="/blog">Blog</a></p>
      <h1>{title && title.kind === "heading" ? renderInline(title.text) : post.seoTitle}</h1>
      <p className="blog-date"><time dateTime={post.published}>{formatBlogDate(post.published)}</time></p>
      {body.map(renderBlock)}
      <div className="actions">
        <a className="btn btn-primary" href="/stay/demo-cottage">See what guests see</a>
        <a className="btn btn-ghost" href="/blog">More from the blog</a>
      </div>
    </article>
  );
}
