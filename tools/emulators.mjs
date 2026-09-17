#!/usr/bin/env node
/* ===========================================================================
   Start the Firebase emulators with a Node that trusts this machine's CAs.

   TLS-inspecting antivirus and corporate proxies (AVG Web/Mail Shield, on the
   machine this was written for) re-sign outbound HTTPS with a private root.
   Windows trusts that root; Node does not, because it ships its own bundled CA
   list and ignores the OS store. Nothing in the app notices until a function
   calls out: `stripe.prices.retrieve` fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE,
   `activationOptions` throws, and the host is told "The server could not start
   activation" — a message about our server, for a fault in the local network
   path. Deployed functions never take this path.

   `--use-system-ca` adds the OS trust store to Node's bundle. It is set here,
   not in a shell profile, so the emulators behave the same however they are
   started, and because the Functions emulator spawns the function runtime as a
   child process that inherits this environment.
   ========================================================================= */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const FLAG = "--use-system-ca";

// An unrecognised flag in NODE_OPTIONS stops Node from starting at all, so an
// older runtime is told what it needs rather than left with a broken emulator.
if (!process.allowedNodeEnvironmentFlags.has(FLAG)) {
  console.error(
    `This Node (${process.version}) has no ${FLAG}. Upgrade to Node 22.15+, or export\n`
      + "NODE_EXTRA_CA_CERTS=<path to your proxy's root certificate> before starting the emulators."
  );
  process.exit(1);
}

const existing = process.env.NODE_OPTIONS ?? "";
const passed = process.argv.slice(2);

const child = spawn(
  process.execPath,
  [
    fileURLToPath(new URL("../node_modules/firebase-tools/lib/bin/firebase.js", import.meta.url)),
    "emulators:start",
    // A demo project id is what keeps the emulators from ever reaching the real
    // one. Overridable, so a deliberate `--project` on the command line wins.
    ...(passed.some(argument => argument.startsWith("--project")) ? [] : ["--project", "demo-digistaybook"]),
    ...passed
  ],
  {
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: existing.includes(FLAG) ? existing : `${existing} ${FLAG}`.trim() }
  }
);

child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 1));
