import assert from "node:assert/strict";
import { createRequire } from "node:module";
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080", "Run only against the local Firestore emulator");
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp({ projectId: "demo-digistaybook" });
// Exercise production admission logic against local storage, without calling providers.
process.env.FUNCTIONS_EMULATOR = "false";
const { reserveScreeningAttempt, screeningDay, screeningCapacityAvailable } = await import("../functions/lib/screeningBudget.js");
const ref = getFirestore().doc(`screeningDailyUsage/${screeningDay()}`);
await ref.delete();
try {
  const results = await Promise.allSettled(Array.from({ length: 125 }, (_, index) =>
    reserveScreeningAttempt(index % 2 ? "memory" : "feedback", "Hello", index % 2 ? 2 : 0)));
  const admitted = results.filter(result => result.status === "fulfilled").length;
  assert.ok(admitted > 0 && admitted <= 100);
  // Contended Firestore transactions may time out before consuming capacity.
  // Fill remaining slots sequentially and confirm no slot beyond 100 exists.
  for (let count = admitted; count < 100; count++) await reserveScreeningAttempt("memory", "Hello", 0);
  await assert.rejects(() => reserveScreeningAttempt("memory", "Hello", 0));
  assert.equal((await ref.get()).get("attempts"), 100);
  assert.equal(await screeningCapacityAvailable(), false);
  console.log(`PASS: ${admitted} concurrent attempts reserved capacity without overshoot; remaining slots filled to exactly 100 and further screening blocked.`);
} finally { await ref.delete(); }
