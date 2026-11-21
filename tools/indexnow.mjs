// Tells IndexNow search engines (Bing and partners) which pages to re-read after a deploy.
// Reads the sitemap just built into dist/, submits every URL. Never fails a deploy.
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const host = "digistaybook.com";
try {
  const dist = resolve("dist");
  const key = (await readdir(dist)).find(f => /^[0-9a-f]{32}\.txt$/.test(f))?.slice(0, -4);
  if (!key) throw new Error("no IndexNow key file in dist/");
  const sitemap = await readFile(resolve(dist, "sitemap.xml"), "utf8");
  const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList })
  });
  console.log(`IndexNow: submitted ${urlList.length} URLs, HTTP ${res.status}`);
} catch (error) {
  console.warn(`IndexNow submission skipped: ${error.message}`);
}
