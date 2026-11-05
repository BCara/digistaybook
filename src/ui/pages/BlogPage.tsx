import { blogDateLabel, blogPath, findPost, readablePosts } from "../../domain/blog";
import { postBodies } from "../blog/posts";
import { NotFoundPage } from "./NotFoundPage";
import "../blog/blog.css";

/** `/blog`: every post a reader may open. With nothing published, it is not a page at all. */
export function BlogIndexPage() {
  const posts = readablePosts();
  if (!posts.length) return <NotFoundPage />;
  return (
    <div className="page narrow-page blog-page">
      <p className="eyebrow">Blog</p>
      <h1>Notes for vacation rental hosts</h1>
      <ul className="blog-list">
        {posts.map(post => (
          <li key={post.slug}>
            <a href={blogPath(post.slug)}>{post.title}</a>
            <p>{post.description}</p>
            <p className="blog-meta">
              {blogDateLabel(post.date)}
              {post.status === "draft" && <span className="blog-draft-badge">Draft</span>}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `/blog/{slug}`. A draft opens only in a dev build, for review; anywhere else it is a 404. */
export function BlogPostPage({ slug }: { slug: string }) {
  const post = findPost(slug);
  const Body = post && postBodies[post.slug];
  if (!post || !Body) return <NotFoundPage />;
  return (
    <article className="page narrow-page blog-page">
      {post.status === "draft" && (
        <div className="notice blog-draft-notice" role="note">
          <strong>Draft for review.</strong>
          <p>This post shows only in a local dev build. It isn’t in the production build, the sitemap or search until it is published.</p>
        </div>
      )}
      <p className="eyebrow"><a href="/blog">Blog</a></p>
      <h1>{post.title}</h1>
      <p className="blog-meta">{blogDateLabel(post.date)}</p>
      <div className="blog-body">
        <Body />
      </div>
    </article>
  );
}
