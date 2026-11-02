import comparisonPost from "../content/blog/digistaybook-vs-touch-stay-hostfully-staypage.md?raw";

/**
 * The blog: a short list of posts kept as Markdown in src/content/blog, read
 * into plain blocks here and drawn as React elements by the blog pages.
 *
 * Only the Markdown the posts actually use is understood: headings, paragraphs,
 * bulleted lists, pipe tables, a horizontal rule, and bold, italic, code and
 * links inline. Nothing is ever injected as HTML, so a post cannot carry markup
 * or script into the page, and a link may only point at one of our own paths
 * or an https address.
 */
export type BlogPost = {
  slug: string;
  /** The search result and browser-tab title. The post's own heading is in its Markdown. */
  seoTitle: string;
  description: string;
  /** ISO date the post went up. */
  published: string;
  markdown: string;
};

export const blogPosts: readonly BlogPost[] = [
  {
    slug: "digistaybook-vs-touch-stay-hostfully-staypage",
    seoTitle: "Digital Guidebooks vs. Guest Journals: DigiStayBook, Touch Stay, Hostfully and StayPage Compared",
    description:
      "An honest look at digital guidebooks, guest journals and paper binders for vacation rentals, and where DigiStayBook fits, from what each site says today.",
    published: "2026-11-02",
    markdown: comparisonPost
  }
];

export const blogPath = (post: Pick<BlogPost, "slug">) => `/blog/${post.slug}`;

export function findBlogPost(pathname: string): BlogPost | undefined {
  const match = /^\/blog\/([^/]+)\/?$/.exec(pathname);
  return match ? blogPosts.find(post => post.slug === match[1]) : undefined;
}

export function formatBlogDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[month - 1]} ${day}, ${year}`;
}

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; children: Inline[] };

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: Inline[] }
  | { kind: "paragraph"; text: Inline[] }
  | { kind: "list"; items: Inline[][] }
  | { kind: "table"; header: Inline[][]; rows: Inline[][][] }
  | { kind: "rule" };

const safeHref = (href: string) => /^\/(?!\/)/.test(href) || /^https:\/\//.test(href) || /^#/.test(href);

/** Bold, italic, inline code and links, in the order they open. */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ kind: "text", text });
    text = "";
  };
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    const strong = /^\*\*(.+?)\*\*/.exec(rest);
    if (strong) {
      flush();
      out.push({ kind: "strong", children: parseInline(strong[1]) });
      i += strong[0].length;
      continue;
    }
    const em = /^\*([^*\s][^*]*?)\*/.exec(rest);
    if (em) {
      flush();
      out.push({ kind: "em", children: parseInline(em[1]) });
      i += em[0].length;
      continue;
    }
    const code = /^`([^`]+)`/.exec(rest);
    if (code) {
      flush();
      out.push({ kind: "code", text: code[1] });
      i += code[0].length;
      continue;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
    if (link) {
      flush();
      if (safeHref(link[2])) out.push({ kind: "link", href: link[2], children: parseInline(link[1]) });
      else out.push(...parseInline(link[1]));
      i += link[0].length;
      continue;
    }
    text += source[i];
    i += 1;
  }
  flush();
  return out;
}

const tableCells = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());

const isTableDivider = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);

export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      i += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length as 1 | 2 | 3, text: parseInline(heading[2].trim()) });
      i += 1;
      continue;
    }
    if (line.trim().startsWith("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const header = tableCells(line).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(tableCells(lines[i]).map(parseInline));
        i += 1;
      }
      blocks.push({ kind: "table", header, rows });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*]\s+/, "");
        i += 1;
        // A wrapped item continues on indented lines.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) {
          item += ` ${lines[i].trim()}`;
          i += 1;
        }
        items.push(parseInline(item));
      }
      blocks.push({ kind: "list", items });
      continue;
    }
    // A paragraph runs until a blank line or the start of another block. A
    // single line break inside it is kept as a break, which the FAQ's
    // question-then-answer pairs rely on.
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3})\s/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !lines[i].trim().startsWith("|")) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    if (paragraph.length === 0) {
      // A stray line no other rule accepts is still shown, never dropped.
      paragraph.push(lines[i].trim());
      i += 1;
    }
    const text: Inline[] = [];
    paragraph.forEach((part, index) => {
      if (index > 0) text.push({ kind: "text", text: "\n" });
      text.push(...parseInline(part));
    });
    blocks.push({ kind: "paragraph", text });
  }
  return blocks;
}

/** Plain words of a run of inline content, for counting and checking. */
export function inlineText(inline: Inline[]): string {
  return inline.map(part => ("children" in part ? inlineText(part.children) : part.text)).join("");
}
