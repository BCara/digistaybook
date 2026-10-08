import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { info, warn } from "firebase-functions/logger";

const context = new AsyncLocalStorage<{ screeningReference: string }>();
export function screeningReference(id: string, revision: number) {
  return createHash("sha256").update(`${id}:${revision}`).digest("hex").slice(0, 24);
}
export function withScreeningDiagnostics<T>(id: string, revision: number, callback: () => Promise<T>): Promise<T> {
  return context.run({ screeningReference: screeningReference(id, revision) }, callback);
}
// Scores and technical outcomes only. Never include text, images, UID, tokens,
// storage paths, raw provider bodies or arbitrary exception messages.
export function screeningDiagnostic(event: string, fields: Record<string, unknown>) {
  const current = context.getStore();
  if (current) info("Guest screening diagnostic", { ...fields, ...current, event });
}
export function screeningError(id: string, revision: number, error: unknown, outcome: string) {
  const message = error instanceof Error ? error.message : "";
  const http = /^(?:moderateText|SafeSearch HTTP) (\d{3})$/.exec(message);
  const reason = http ? `provider_http_${http[1]}`
    : error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "provider_timeout"
    : message === "Daily screening allowance reached" ? "daily_capacity_exhausted"
    : message === "Incomplete SafeSearch response" || message === "Unknown SafeSearch likelihood" || message === "Incomplete text moderation response" ? "invalid_provider_response"
    : "provider_or_storage_error";
  warn("Guest screening did not complete", { event: "screening_error", screeningReference: screeningReference(id, revision), reason, outcome });
}
