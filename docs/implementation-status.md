# DigiStayBook implementation checkpoint

## Current position

- **Authority:** `digistaybook_WIP_v3.md`
- **Branch:** `codex/implementation-foundation`
- **Baseline:** `da70e30` (`docs: publish reviewed DigiStayBook BOP v3`)
- **Current milestone:** A - executable foundation
- **Machine-readable status:** `docs/implementation-status.json`
- **Resume command:** `node tools/verify-implementation-status.mjs`

The plan/status checkpoint is being committed before application scaffolding. This means an interruption after this point can resume from the workstream and task IDs below without reconstructing the plan from chat history.

## Workstream checkpoint

| Workstream | State | Immediate evidence |
|---|---|---|
| `WS-00` Delivery control | In progress | Persistent plan, status JSON, human checkpoint and validator |
| `WS-10` Platform foundation | Started | Architecture selected; scaffold is next |
| `WS-20` Guest experience | Started | BOP scope and first vertical slice defined |
| `WS-30` Host experience | Started | BOP scope and first vertical slice defined |
| `WS-40` Trust and safety | Started | Authoritative reporting state model selected |
| `WS-50` Commercial and communications | Started | Billing/email/consent boundaries selected |
| `WS-60` Privacy and retention | Started | Retention matrix and public route selected |
| `WS-70` Quality and release | Started | Evidence levels and CI gate selected |
| `WS-80` Post-MVP guardrails | Started | Disabled-by-default registry selected |

## Evidence meanings

- **Local:** source exists and local verification passes.
- **Emulator:** Firebase Auth/Firestore/Storage/Functions behaviour passes in the Emulator Suite.
- **Deployed:** the exact cloud project and deployed revision are verified.
- **Manual:** a person/device/browser journey is visibly confirmed.

These levels are never collapsed into one “done” label. The ledger records the strongest demonstrated level for each task.

## Resume procedure

1. Run `git status --short` and do not absorb unrelated files.
2. Run `node tools/verify-implementation-status.mjs`.
3. Read the active task entries in `docs/implementation-status.json`.
4. Run each active task’s `verification` command.
5. Continue from the first failing or still-started task, then update evidence and commit.

