import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "australia-southeast1", maxInstances: 10 });

export const health = onRequest((request, response) => {
  response.status(200).json({ service: "digistaybook-functions", status: "ok" });
});

// Privileged report, contribution, billing, email and deletion handlers are
// added only with App Check, idempotency, transaction and emulator tests.
// No permissive placeholder endpoint is exported for those workflows.
