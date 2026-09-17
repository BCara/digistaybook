#!/usr/bin/env node
/* ===========================================================================
   Write the environment URLs into the test procedures document.

   The tester is handed the HTML file and nothing else, so the link they are
   meant to test has to be inside it. Hosting preview channels are re-deployed
   between runs and the URL changes with the channel name, so editing the
   markup by hand is a step that gets forgotten. This writes both the href and
   the visible text of the marked line, and refuses to write anything that is
   not an https URL — a half-edited link in a handed-over document is worse
   than an obviously missing one.

     node tools/set-test-link.mjs prelive https://<project>--<channel>.web.app
     node tools/set-test-link.mjs live     https://digistaybook.com
     node tools/set-test-link.mjs --show
   ========================================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DOC = fileURLToPath(
  new URL("../docs/handbook/DIGISTAYBOOK_TEST_PROCEDURES.html", import.meta.url)
);

const SLOTS = {
  prelive: { label: "Site to test" },
  live: { label: "Live site" }
};

// The document is read by someone non-technical, so the unfilled state says
// what is missing in their words, not ours.
const PENDING =
  '<span class="testlink pending">to be filled in before this document is sent</span>';

function slotPattern(slot) {
  return new RegExp(
    `(<!-- LINK:${slot} -->)([\\s\\S]*?)(<!-- /LINK -->)`,
    "g"
  );
}

function read() {
  if (!fs.existsSync(DOC)) {
    console.error(`Document not found: ${DOC}`);
    process.exit(1);
  }
  return fs.readFileSync(DOC, "utf8");
}

function show() {
  const html = read();
  for (const slot of Object.keys(SLOTS)) {
    const m = slotPattern(slot).exec(html);
    if (!m) { console.log(`${slot.padEnd(8)} slot missing from the document`); continue; }
    // Only a set link is an <a class="testlink">; the pending state is a span
    // that contains a cross-reference link of its own.
    const href = /<a class="testlink" href="([^"]*)"/.exec(m[2]);
    console.log(`${slot.padEnd(8)} ${href ? href[1] : "not yet issued"}`);
  }
}

const [slot, url] = process.argv.slice(2);

if (!slot || slot === "--show") { show(); process.exit(0); }

if (slot === "--clear") {
  const html = read();
  let out = html;
  for (const s of Object.keys(SLOTS)) {
    out = out.replace(slotPattern(s), `$1${PENDING}$3`);
  }
  fs.writeFileSync(DOC, out, "utf8");
  console.log("Both links reset to “not yet issued”.");
  process.exit(0);
}

if (!Object.prototype.hasOwnProperty.call(SLOTS, slot)) {
  console.error(`Unknown slot "${slot}". Use one of: ${Object.keys(SLOTS).join(", ")}, or --show.`);
  process.exit(1);
}

if (!url) {
  console.error(`Usage: node tools/set-test-link.mjs ${slot} <https url>`);
  process.exit(1);
}

// A tester copies whatever is printed. Anything that is not a plain https
// origin is a mistake worth stopping on, not a link worth publishing.
let parsed;
try { parsed = new URL(url); } catch { parsed = null; }
if (!parsed || parsed.protocol !== "https:") {
  console.error(`"${url}" is not an https URL. The handed-over link must be https.`);
  process.exit(1);
}

const clean = parsed.toString().replace(/\/$/, "");
const html = read();
const pattern = slotPattern(slot);

if (!pattern.test(html)) {
  console.error(`The <!-- LINK:${slot} --> marker is missing from the document.`);
  process.exit(1);
}

const replaced = html.replace(
  slotPattern(slot),
  `$1<a class="testlink" href="${clean}">${clean}</a>$3`
);

fs.writeFileSync(DOC, replaced, "utf8");
console.log(`${SLOTS[slot].label} set to ${clean}`);
console.log(`Wrote ${path.relative(process.cwd(), DOC)}`);
