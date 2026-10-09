import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { warn } from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { OUTSTANDING } from "./reporting.js";

// Queues a person must act on, announced when an item is created. Consent
// reviews have their own daily reminder, so they are not announced here.
export const ANNOUNCED = ["trustSafetyCases", "contentReports", "privacyRequests", "operationsAlerts"] as const;
// Deletion jobs normally finish unattended; only one that stops is announced.
export const STUCK = ["held", "needs_attention"];
const LABELS: Record<string, string> = { trustSafetyCases: "safety cases", contentReports: "content reports", privacyRequests: "privacy requests",
  operationsAlerts: "alerts", deletionJobs: "stuck photo deletions" };
const ORDER = [...ANNOUNCED, "deletionJobs"];
// A serverTimestamp is fixed at commit, so a write can land with a time just
// before a sweep that has already run. Sweeping up to a minute ago covers that.
const SETTLE_MS = 60000;

export type NewItems = { queue: string; kind: string | null }[];
export function describeNewItems(items: NewItems) {
  const byQueue = ORDER.map(queue => [queue, items.filter(item => item.queue === queue)] as const).filter(([, list]) => list.length);
  const kinds = [...new Set(items.map(item => item.kind).filter(Boolean))].map(kind => kind!.replace(/_/g, " "));
  return { newCount: items.length, queues: byQueue.map(([queue, list]) => `${list.length} ${LABELS[queue]}`).join(", "), kinds: kinds.join(", ") || "unspecified" };
}
// "held: safety review required", "needs attention: attempt limit"
const stuckKind = (status: string, reason: unknown) => `deletion ${status}${typeof reason === "string" ? `: ${reason}` : ""}`;

export async function announceNewOperationsItems(now = Date.now()) {
  const db = getFirestore(), stateRef = db.doc("operationsNotifyState/newItems"), state = await stateRef.get();
  const until = Timestamp.fromMillis(now - SETTLE_MS), since: Timestamp | undefined = state.get("sweptUntil");
  const stuckDocs = (await db.collection("deletionJobs").where("status", "in", STUCK).limit(500).get()).docs;
  // A job is announced once per stuck status; if it recovers and sticks again it is announced again.
  const stuckKeys = stuckDocs.map(doc => `${doc.id}:${doc.get("status")}`);
  // The first sweep only sets the starting point; the operations page already shows any backlog.
  if (!since) { await stateRef.set({ sweptUntil: until, stuckAnnounced: stuckKeys, sweptAt: FieldValue.serverTimestamp() }); return null; }
  const window = until.toMillis() > since.toMillis();
  const pages = window ? await Promise.all(ANNOUNCED.map(async queue => (await db.collection(queue).where("createdAt", ">", since).where("createdAt", "<=", until).limit(200).get())
    .docs.filter(doc => OUTSTANDING[queue].includes(doc.get("status"))).map(doc => ({ queue, kind: (doc.get("kind") ?? doc.get("reason") ?? null) as string | null })))) : [];
  const announced = new Set<string>(state.get("stuckAnnounced") ?? []);
  const stuck = stuckDocs.filter((_, index) => !announced.has(stuckKeys[index]))
    .map(doc => ({ queue: "deletionJobs", kind: stuckKind(doc.get("status"), doc.get(doc.get("status") === "held" ? "holdReason" : "failureCode")) }));
  const items = [...pages.flat(), ...stuck], summary = describeNewItems(items);
  // Only counts and kinds leave the system: no guest text, names, photos or contact details.
  if (items.length) warn("DigiStayBook has new items for safety review", {
    event: "operations_new_items", ...summary, operationsUrl: "https://digistaybook-cbert.web.app/operations", recipient: "codebertcreations@gmail.com"
  });
  await stateRef.set({ sweptUntil: window ? until : since, stuckAnnounced: stuckKeys, sweptAt: FieldValue.serverTimestamp(), lastNewCount: items.length });
  return items.length ? summary : null;
}

export const notifyNewOperationsItems = onSchedule({ schedule: "every 5 minutes", region: "australia-southeast1", maxInstances: 1, retryCount: 3, minBackoffSeconds: 60 },
  async () => { await announceNewOperationsItems(); });
