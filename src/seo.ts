import { guestTerms, hostTerms, privacyPolicy } from "./ui/pages/legal/documents";
import { DEMO_SLUG } from "./ui/wall/demoWall";

/**
 * What each address tells a search engine and a link preview.
 *
 * One table, read twice: the client applies it on every navigation, and the
 * build's prerender step (tools/prerender.mjs) writes it into the static HTML
 * of the marketing pages, so a crawler that never runs our script still gets
 * the right title, description and canonical address.
 *
 * Only the acquisition pages and the demo wall are indexed. A Host's console,
 * the operations desk and the account-action pages are nobody's search result,
 * and a real wall is a Host's guests' memories: it is shared by link, not
 * listed by Google.
 */
export const SITE_ORIGIN = "https://digistaybook.com";
export const SITE_NAME = "DigiStayBook";
export const SOCIAL_IMAGE = `${SITE_ORIGIN}/og-image.jpg`;

export type PageSeo = {
  title: string;
  description: string;
  /** The canonical path, or null when the page is not to be indexed. */
  canonical: string | null;
};

const defaultDescription =
  "DigiStayBook is a digital guestbook for short-term rental hosts: one QR code for your house guidance, local recommendations and a shared wall of guest memories.";

const titled = (title: string) => `${title} | ${SITE_NAME}`;

/** The pages listed in the sitemap, in the order they are listed. */
export const indexedPaths = ["/", "/pricing", `/wall/${DEMO_SLUG}`, "/privacy-safety", "/terms", "/guest-terms", "/privacy"] as const;

/** The indexed pages the build writes out as static HTML; the demo wall reads its data at runtime. */
export const prerenderedPaths = indexedPaths.filter(path => !path.startsWith("/wall/"));

const pages: Record<(typeof indexedPaths)[number], Omit<PageSeo, "canonical">> = {
  "/": {
    title: "DigiStayBook: a digital guestbook for short-term rental hosts",
    description: defaultDescription
  },
  "/pricing": {
    title: titled("Pricing"),
    description: "One price per property, billed monthly or annually, with a 28-day free trial. Every DigiStayBook plan includes the QR kit, guest wall, screening and moderation."
  },
  [`/wall/${DEMO_SLUG}`]: {
    title: titled("Live guest wall demo"),
    description: "See a DigiStayBook guest wall as guests meet it: house guidance and local favourites pinned to the top, and screened memories from past stays."
  },
  "/privacy-safety": {
    title: titled("Privacy & Safety requests"),
    description: "Make a personal-data request, report content for takedown or raise an urgent platform safety concern with DigiStayBook."
  },
  "/terms": {
    title: titled(hostTerms.title),
    description: "The terms and conditions that apply to Hosts using DigiStayBook."
  },
  "/guest-terms": {
    title: titled(guestTerms.title),
    description: "The terms that apply to guests who read or post on a DigiStayBook wall."
  },
  "/privacy": {
    title: titled(privacyPolicy.title),
    description: "How DigiStayBook collects, uses, stores and deletes personal information for Hosts and guests."
  }
};

const isIndexed = (pathname: string): pathname is (typeof indexedPaths)[number] =>
  (indexedPaths as readonly string[]).includes(pathname);

export function pageSeo(pathname: string): PageSeo {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (isIndexed(path)) return { ...pages[path], canonical: path };
  if (path === "/host/sign-in") return { title: titled("Host sign in"), description: defaultDescription, canonical: null };
  if (path === "/host/sign-up") return { title: titled("Create a host account"), description: defaultDescription, canonical: null };
  return { title: pages["/"].title, description: defaultDescription, canonical: null };
}

/** The not-found page's own entry, used for the static 404 document. */
export const notFoundSeo: PageSeo = { title: titled("Page not found"), description: defaultDescription, canonical: null };

/** Mirror a page's entry into the live document's head. */
export function applySeo(seo: PageSeo): void {
  document.title = seo.title;
  setMeta("name", "description", seo.description);
  setMeta("property", "og:title", seo.title);
  setMeta("property", "og:description", seo.description);
  setMeta("property", "og:url", seo.canonical ? `${SITE_ORIGIN}${seo.canonical}` : null);
  setMeta("name", "robots", seo.canonical ? null : "noindex");
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!seo.canonical) link?.remove();
  else {
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.append(link);
    }
    link.href = `${SITE_ORIGIN}${seo.canonical}`;
  }
}

function setMeta(attribute: "name" | "property", key: string, content: string | null): void {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (content === null) {
    meta?.remove();
    return;
  }
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, key);
    document.head.append(meta);
  }
  meta.content = content;
}

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The same entry as static head markup, for the prerendered documents. */
export function seoHeadMarkup(seo: PageSeo): string {
  const url = seo.canonical ? `${SITE_ORIGIN}${seo.canonical}` : null;
  return [
    `<title>${escape(seo.title)}</title>`,
    `<meta name="description" content="${escape(seo.description)}" />`,
    `<meta property="og:title" content="${escape(seo.title)}" />`,
    `<meta property="og:description" content="${escape(seo.description)}" />`,
    url ? `<meta property="og:url" content="${url}" />` : `<meta name="robots" content="noindex" />`,
    url ? `<link rel="canonical" href="${url}" />` : ""
  ].filter(Boolean).join("\n    ");
}
