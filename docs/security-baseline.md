# Security baseline and release gates

## Demonstrated local controls

- Firestore rules allow only scoped public reads and Host-owned account/property access; unmatched access is denied.
- Storage is denied by default until a narrowly scoped upload flow has emulator coverage.
- Guest content is not written directly from the browser. Server-controlled write endpoints remain a release requirement.
- Host access fails closed when Firebase configuration is unavailable.
- Post-MVP features are disabled by default.
- Root production dependencies currently report zero known vulnerabilities with `npm audit --omit=dev`.

These controls are source-level evidence only until the Emulator Suite proves the rules and endpoints together.

## Open dependency advisory gate

The current Functions dependency tree reports seven moderate transitive advisories through the supported `firebase-admin` and `firebase-functions` dependency chain (`uuid`, `gaxios`, `teeny-request` and `retry-request`). A non-breaking audit fix does not resolve them.

- Only the low-risk health endpoint is exported at this checkpoint.
- Privileged guest, moderation, billing, email and deletion functions must not be deployed until their emulator tests pass.
- Do not use a forced dependency downgrade merely to clear the audit count; review a compatible upstream fix or document a time-bounded risk acceptance before production deployment.
- Re-run `npm audit --prefix functions` at every release checkpoint.

## Next security evidence

`IMP-1002` and `IMP-7002` must add Emulator Suite tests for public/private reads, Host ownership, guest direct-write denial, hidden-content visibility, App Check enforcement and transaction-safe moderation changes.
