// Writes the marketing pages out as static HTML after `vite build`.
//
// The client build leaves dist/index.html as the empty shell every app route
// is served from. This keeps that shell as dist/app.html, then renders each
// indexed page through the server entry (src/prerender.tsx, built to
// .prerender/) into its own document with its own head, plus dist/404.html,
// dist/sitemap.xml. firebase.json serves app routes from app.html and
// anything it does not know as 404.html with a real 404 status.
import { readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const dist = resolve("dist");
const entry = pathToFileURL(resolve(".prerender/prerender.js")).href;
const { renderPage, prerenderedPaths, indexedPaths, SITE_ORIGIN } = await import(entry);

const shell = await readFile(resolve(dist, "index.html"), "utf8");
if (!shell.includes('<div id="root"></div>')) throw new Error("dist/index.html is not the empty app shell; run vite build first.");
await writeFile(resolve(dist, "app.html"), shell);

// Tags the page's own head replaces; everything else in the shell's head stays.
const replaced = [
  /\s*<title>[\s\S]*?<\/title>/,
  /\s*<meta name="description"[^>]*>/,
  /\s*<meta property="og:title"[^>]*>/,
  /\s*<meta property="og:description"[^>]*>/
];

function documentFor(path) {
  const { body, head } = renderPage(path);
  let html = shell;
  for (const pattern of replaced) html = html.replace(pattern, "");
  return html
    .replace("</head>", `  ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

const fileFor = path => (path === "/" ? "index.html" : `${path.slice(1)}.html`);
for (const path of prerenderedPaths) await writeFile(resolve(dist, fileFor(path)), documentFor(path));
await writeFile(resolve(dist, "404.html"), documentFor("/404"));

const today = new Date().toISOString().slice(0, 10);
await writeFile(resolve(dist, "sitemap.xml"), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...indexedPaths.map(path => `  <url><loc>${SITE_ORIGIN}${path}</loc><lastmod>${today}</lastmod></url>`),
  "</urlset>",
  ""
].join("\n"));

await rm(resolve(".prerender"), { recursive: true, force: true });
console.log(`Prerendered ${prerenderedPaths.length} pages, 404.html and sitemap.xml (${indexedPaths.length} URLs).`);
