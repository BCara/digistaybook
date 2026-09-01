# DigiStayBook implementation checkpoint

## Current position

- **Authority:** `digistaybook_WIP_v3.md`
- **Branch:** `codex/implementation-foundation`
- **Baseline:** `da70e30` (`docs: publish reviewed DigiStayBook BOP v3`)
- **Last completed checkpoint:** Documentation - content-only BOP comparison
- **Current milestone:** B - server-controlled persistence slice
- **Machine-readable authority:** `docs/implementation-status.json`
- **Resume command:** `npm run check`

The plan/status checkpoint was committed before application scaffolding as `c0931bb`. The source, tests and evidence below form the next checkpoint. An interruption can resume from the task IDs without reconstructing the plan from chat history.

## Workstream checkpoint

| Workstream | State | Locally verified first slice | Active next task |
|---|---|---|---|
| `WS-00` Delivery control | In progress | Persistent plan, ledger, validator and content-only BOP comparison tooling | Maintain checkpoint after each verified slice |
| `WS-10` Platform foundation | In progress | React/TypeScript/Vite, Firebase boundaries, emulator-verified Firestore rules and the token-driven brand/design system | Server-controlled persistence endpoints |
| `WS-20` Guest experience | In progress | Guest Wall, consent contract and responsive acquisition footer | `IMP-2002` server-controlled contribution persistence |
| `WS-30` Host experience | In progress | Host shell, fail-closed auth entry, property contracts and emulator-verified ownership rules | Complete `IMP-3002` Auth UI and data adapters |
| `WS-40` Trust and safety | In progress | Reporting state machine and threshold tests | `IMP-4002` protected transactional report endpoint |
| `WS-50` Commercial/comms | In progress | Billing, consent, suppression and email contracts | `IMP-5002` Stripe/email adapter boundaries |
| `WS-60` Privacy/retention | In progress | Public route and retention/deletion contracts | `IMP-6002` privacy workflow and deletion manifests |
| `WS-70` Quality/release | In progress | Tests, build, CI, evidence separation, emulator suite and advisory gate | Expand integration and accessibility evidence with each slice |
| `WS-80` Post-MVP guardrails | Deferred | Disabled-by-default feature registry | Remain disabled until an approved post-MVP decision |

## Demonstrated local evidence

- Eight unit/UI test files and 22 tests pass.
- Application and Functions TypeScript projects compile.
- The web production build completes; the initial application chunk is approximately 260 kB before gzip and 79 kB after gzip.
- Desktop landing and mobile Guest Wall were inspected locally; the mobile view had no horizontal overflow.
- The brand/design system renders on every route in light and dark colour schemes with no external font, icon or image request; the 375 px landing, Guest Wall and Host routes show no horizontal overflow and the mobile navigation disclosure toggles correctly.
- Host access fails closed without Firebase configuration.
- The public privacy/safety route preserves the support boundary.
- Eight Firestore Emulator tests prove public/private visibility, Host ownership, bounded create/update behaviour and direct guest-write denial.
- `DSB-BOP-P6-010` is present in the Markdown, DOCX and readable HTML; its public Guest Wall link is responsive and navigates to the main landing page.
- The v2-to-v3 comparison contains 110 genuine content-change blocks, with requirement-ID suffixes and ID-convention metadata excluded.

See `docs/release-evidence.md` for the exact evidence boundary and `docs/security-baseline.md` for unresolved release gates.

## Evidence meanings

- **Planned:** scope and verification command exist, but behaviour has not been demonstrated.
- **Local:** source exists and local verification passes.
- **Emulator:** Firebase Auth/Firestore/Storage/Functions behaviour passes in the Emulator Suite.
- **Deployed:** the exact cloud project and deployed revision are verified.
- **Manual:** a person/device/browser journey is visibly confirmed.

These levels are never collapsed into one "done" label. The ledger records the strongest demonstrated level for each task.

## Resume procedure

1. Run `git status --short` and do not absorb unrelated files.
2. Run `npm run check`.
3. Read the active task entries in `docs/implementation-status.json`.
4. Continue from the first failing or still-started task.
5. Update the evidence level and evidence paths only after verification, then commit the checkpoint.
