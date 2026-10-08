/** Fixtures are enabled only by the local launcher, inside the exact demo emulator. */
export function localTestEnabled() {
  return process.env.FUNCTIONS_EMULATOR === "true"
    && process.env.LOCAL_TEST_SCREENING === "true"
    && (process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT) === "demo-digistaybook";
}
export function localScenario(message: string): "clear" | "standard" | "critical" | "unavailable" {
  if (/\[outage\]/i.test(message)) return "unavailable";
  if (/\[safety\]/i.test(message)) return "critical";
  if (/\[review\]/i.test(message)) return "standard";
  return "clear";
}
