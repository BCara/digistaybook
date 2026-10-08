import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { warn } from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/v2/scheduler";

export const dailyScreeningLimit = 100;
export const dailyScreeningWarning = 75;
export class ScreeningBudgetReached extends Error {}

export function screeningDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
const usageRef = (now = new Date()) => getFirestore().doc(`screeningDailyUsage/${screeningDay(now)}`);

export async function screeningCapacityAvailable(): Promise<boolean> {
  if (process.env.FUNCTIONS_EMULATOR === "true") return true;
  return ((await usageRef().get()).get("attempts") ?? 0) < dailyScreeningLimit;
}

// Reserve before contacting either provider. Failed provider calls, edits and
// retries consume capacity too. One memory with multiple photos is one attempt.
export async function reserveScreeningAttempt(kind: "memory" | "feedback", message: string, photos = 0): Promise<void> {
  if (process.env.FUNCTIONS_EMULATOR === "true") return;
  const ref = usageRef();
  const attempts = await getFirestore().runTransaction(async tx => {
    const data = (await tx.get(ref)).data() ?? {};
    if ((data.attempts ?? 0) >= dailyScreeningLimit) throw new ScreeningBudgetReached("Daily screening allowance reached");
    const next = (data.attempts ?? 0) + 1;
    tx.set(ref, { attempts: next, limit: dailyScreeningLimit, warningAt: dailyScreeningWarning,
      photoChecksReserved: (data.photoChecksReserved ?? 0) + photos,
      textUnitsReserved: (data.textUnitsReserved ?? 0) + Math.ceil(Array.from(message).length / 100),
      [kind]: (data[kind] ?? 0) + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return next;
  });
  if (attempts === dailyScreeningWarning) emitWarning(ref.id, attempts);
}

function emitWarning(day: string, attempts: number) {
  warn("DigiStayBook daily screening allowance is nearly used", {
    event: "screening_daily_warning", day, attempts, limit: dailyScreeningLimit,
    remaining: dailyScreeningLimit - attempts, timezone: "Australia/Sydney"
  });
}

// Re-emit while above the threshold so an interrupted request cannot lose the
// email warning. Cloud Monitoring suppresses repeat notifications for 24 hours.
export const notifyScreeningAllowance = onSchedule({ schedule: "every 5 minutes", region: "australia-southeast1", maxInstances: 1 }, async () => {
  const ref = usageRef(), attempts = (await ref.get()).get("attempts") ?? 0;
  if (attempts >= dailyScreeningWarning) emitWarning(ref.id, attempts);
});
