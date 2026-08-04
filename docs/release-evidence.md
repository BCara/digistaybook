# Release evidence

This file records what has actually been demonstrated. It does not treat a local build as deployment, production readiness, or legal approval.

## Milestone A - first executable slice

- **Branch:** `codex/implementation-foundation`
- **Plan checkpoint:** `c0931bb` (`docs: establish autonomous implementation checkpoint`)
- **Authority:** `digistaybook_WIP_v3.md`
- **Evidence level:** local

### Automated evidence

- Implementation ledger and BOP references validate with `node tools/verify-implementation-status.mjs`.
- TypeScript application and Functions projects compile.
- Seven test files containing 19 tests pass.
- The production web bundle builds successfully; the initial application chunk is approximately 260 kB before gzip and 79 kB after gzip.
- The root production dependency audit reports zero known vulnerabilities.

### Rendered browser evidence

- Landing page inspected at desktop size.
- Guest Wall inspected at 390 by 844 pixels with no horizontal overflow.
- Host entry fails closed when Firebase configuration is absent; no development sign-in bypass is exposed.
- The public Privacy and Safety route is available and distinguishes privacy/safety requests from booking, property and in-stay support.

### Evidence not yet demonstrated

- Firebase Emulator Suite behaviour.
- Any deployed Firebase project or revision.
- Stripe, email-provider or production App Check integration.
- Device testing or human acceptance testing outside the local browser inspection.
- Professional legal approval of publication-controlled text and processes.

## Resume rule

Run `npm run check`, then continue from the first `started` or `in_progress` task in `docs/implementation-status.json`. Upgrade an evidence level only when that level has been directly demonstrated.
