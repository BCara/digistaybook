import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { error, info } from "firebase-functions/logger";
import { defineSecret, defineString } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { addDays, buildSummary, extraTestEmails, loadSnapshot, portfolioTestEmails, sydneyDate, TIMEZONE, type PortfolioSummary, type Snapshot } from "./portfolioSummary.js";

/* ===========================================================================
   ownerDailyReport — one short email to the owner each morning, Sydney time.

   The same numbers as the portfolio summary feed, for yesterday. It goes to
   the operations address the other owner notices use, through the same mail
   provider as the host digests. Sent at most once per Sydney day: a
   `ownerDailyReports/{date}` record is claimed before sending and the mail
   provider is given the date as its idempotency key, so a retry after a crash
   cannot send a second copy. With no address configured nothing is sent.
   ========================================================================= */

const resendKey = defineSecret("RESEND_API_KEY");
/** Set to an empty value to stop the email. */
export const ownerReportEmail = defineString("OWNER_REPORT_EMAIL", { default: "codebertcreations@gmail.com" });
const emulator = process.env.FUNCTIONS_EMULATOR === "true";
/** A claim older than this is taken to be a run that died; the provider key still stops a double send. */
const CLAIM_MS = 15 * 60_000;

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const shown = (value: number | null) => value === null ? "n/a" : String(value);
const sydneyDay = (ms: number) => new Intl.DateTimeFormat("en-AU", { timeZone: TIMEZONE, weekday: "short", day: "numeric", month: "short" }).format(new Date(ms));

export function ownerReportContent(summary: PortfolioSummary) {
  const { day, last7, prev7, totals, extra } = summary;
  const lines = [
    `Sign-ups: ${day.signUps} (7 days ${last7.signUps}, before that ${prev7.signUps})`,
    `New properties: ${day.newEvents} (7 days ${last7.newEvents}, before that ${prev7.newEvents})`,
    `Guest contributions: ${day.uploads} (7 days ${last7.uploads}, before that ${prev7.uploads})`,
    `New subscriptions: ${day.upgrades} (7 days ${last7.upgrades}, before that ${prev7.upgrades})`,
    `Cancellations: ${extra.cancellations.day} (7 days ${extra.cancellations.last7})`,
    `Live subscriptions: ${extra.activeSubscriptions} paying, ${extra.trialing} on trial`,
    `Waiting for review: ${extra.awaitingModeration.host} with hosts, ${extra.awaitingModeration.safetyTeam} with the safety team`,
    `Totals: ${totals.accounts} hosts, ${totals.events} properties, ${totals.uploads} contributions`
  ];
  const signUps = summary.signUps.map(account => `${account.name || "(no name)"} <${account.email}>`);
  const properties = summary.newEvents.map(property => `${property.name}, ${property.host || property.hostEmail}`);
  const trials = extra.trialsEndingSoon.map(trial => `${trial.name}, ${trial.host || trial.hostEmail}: trial ends ${sydneyDay(trial.trialEndsAt!)}`);
  const sections: [string, string[]][] = [["Yesterday", lines], ["Who signed up", signUps], ["New properties", properties], ["Trials ending in the next 14 days", trials],
    ["Notes", [...summary.notes, `Left out as owner or test: ${summary.testExcluded.accounts} accounts, ${summary.testExcluded.events} properties.`]]];
  const filled = sections.filter(([, rows]) => rows.length);
  const subject = `DigiStayBook ${summary.date}: ${day.signUps} sign-up${day.signUps === 1 ? "" : "s"}, ${day.newEvents} new propert${day.newEvents === 1 ? "y" : "ies"}`;
  return {
    subject,
    text: `DigiStayBook daily report for ${summary.date} (Sydney)\n\n${filled.map(([title, rows]) => `${title}\n${rows.map(row => `- ${row}`).join("\n")}`).join("\n\n")}\n`,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#F7F2E8;color:#14181B;font-family:Arial,sans-serif"><div style="max-width:560px;margin:24px auto;padding:28px;background:#fff;border-radius:12px"><p style="font-size:18px;font-weight:bold">DigiStayBook daily report for ${escape(summary.date)}</p>${filled.map(([title, rows]) => `<p style="font-weight:bold;margin:20px 0 6px">${escape(title)}</p><ul style="line-height:1.7;padding-left:20px;margin:0">${rows.map(row => `<li>${escape(row)}</li>`).join("")}</ul>`).join("")}</div></body></html>`
  };
}

export type SendDeps = { to: () => string; load: (date: string) => Promise<Snapshot>; extra: () => string[];
  deliver: (message: { to: string; subject: string; text: string; html: string; idempotencyKey: string }) => Promise<string> };

export async function sendOwnerDailyReport(now: number, deps: SendDeps) {
  const to = deps.to().trim();
  if (!to) return { status: "no_address" as const };
  const date = addDays(sydneyDate(now), -1);
  const db = getFirestore(), ref = db.doc(`ownerDailyReports/${date}`);
  const claimed = await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.get("status") === "sent") return false;
    if (current.get("status") === "sending" && now - (current.get("claimedAt")?.toMillis?.() ?? 0) < CLAIM_MS) return false;
    tx.set(ref, { status: "sending", claimedAt: Timestamp.fromMillis(now), attempts: (current.get("attempts") ?? 0) + 1 }, { merge: true });
    return true;
  });
  if (!claimed) return { status: "already_sent" as const, date };
  try {
    const content = ownerReportContent(buildSummary(await deps.load(date), date, now, deps.extra()));
    const providerId = await deps.deliver({ to, ...content, idempotencyKey: `owner-daily-${date}` });
    await ref.set({ status: "sent", providerId, sentAt: FieldValue.serverTimestamp() }, { merge: true });
    info("Owner daily report accepted", { date, providerId });
    return { status: "sent" as const, date };
  } catch (cause) {
    await ref.set({ status: "failed", reason: cause instanceof Error ? cause.message.slice(0, 120) : "unknown" }, { merge: true });
    error("Owner daily report failed", { date, reason: cause instanceof Error ? cause.message : "unknown" });
    throw cause;
  }
}

async function resend(message: { to: string; subject: string; text: string; html: string; idempotencyKey: string }) {
  if (emulator) return "emulated";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${resendKey.value()}`, "Content-Type": "application/json", "Idempotency-Key": message.idempotencyKey },
    body: JSON.stringify({ from: "DigiStayBook <noreply@digistaybook.com>", to: [message.to], subject: message.subject, text: message.text, html: message.html })
  });
  if (!response.ok) throw new Error(`mail-provider-${response.status}`);
  const result = await response.json() as { id?: string };
  if (!result.id) throw new Error("mail-provider-missing-id");
  return result.id;
}

export const sendOwnerDailyReportJob = onSchedule({ schedule: "30 0 * * *", timeZone: TIMEZONE, region: "australia-southeast1", maxInstances: 1,
  retryCount: 2, minBackoffSeconds: 300, secrets: emulator ? [] : [resendKey] },
  async () => { await sendOwnerDailyReport(Date.now(), { to: () => ownerReportEmail.value(), load: loadSnapshot, deliver: resend,
    extra: () => extraTestEmails(portfolioTestEmails.value()) }); });
