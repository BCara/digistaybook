# Screening validation set — 2 October 2026

Updated 5 October: serious memory text expectations now use `critical`, matching
private feedback safety categories. Non-severe profanity flagged in a public
memory goes to host review; an ordinary private complaint still reaches the
host inbox. Incomplete scans in both routes wait privately for bounded retry.
These source changes require deployment and provider calibration before release.

Status: prepared, not provider-calibrated. No guest content is included. Text
labels are proposed product expectations, not Google results or approved policy.
Owner/reviewer must confirm labels before changing thresholds. Small synthetic
sets can expose errors but cannot establish real-world accuracy.

## Text set

`text-fixtures.json` contains 20 labelled synthetic examples. Test the provider
and final policy outcome separately: contact/link holds come from local code,
while private complaints intentionally differ from public memories. Add spelling
variants, euphemisms, other supported languages and longer messages after this
first pass. Add authorised sexual-content/hate examples before claiming coverage
of those categories; the initial set is incomplete in those areas.

## Image acquisition list

Actual image assets remain to be supplied or sourced with recorded permission.
Do not use real guest photos or illegal material for this exercise.

| ID | Asset required | Proposed expected outcome | Reason |
|---|---|---|---|
| P01 | Empty garden/daylight landscape | clear | Basic benign image |
| P02 | Empty indoor room | clear | Guest-property context |
| P03 | Meal on a table | clear | Ordinary holiday photo |
| P04 | Authorised adult group portrait | clear | People without sensitive context |
| P05 | Authorised adults in ordinary beachwear | clear | Over-holding risk |
| P06 | Empty swimming pool | clear | Context without people |
| P07 | First-aid kit without injury | clear | Medical false positives |
| P08 | Museum display of historical weapons | review decision required | Context-sensitive violence |
| P09 | Licensed non-graphic staged adult injury | standard | Medical/violence calibration |
| P10 | Licensed adult suggestive image, no minors | standard | Racy/adult calibration |
| P11 | Dark/blurred variants of P01–P03 | clear if valid | Image quality effects |
| P12 | Text/contact details visible in a benign image | review decision required | Current SafeSearch does not perform OCR/contact detection |

Record file hash, source, permission, label author and transformed size. Test
the actual transformed WebP bytes sent by the product. SafeSearch confidence is
not an age detector, consent checker or comprehensive illegal-content detector.

## Execution and acceptance

1. Confirm labels and acquire the image set. Reserve test usage within the daily
   allowance; do not change production counters to manufacture capacity.
2. Use real provider calls from the deployed runtime identity. Record all scores,
   route, revision, attempt count, latency and errors. Developer-account calls
   must be marked separately. Avoid guest-content logs.
3. Record each expected/actual outcome and each missed harmful example or benign
   hold. Do not silently relabel an example to match a provider result.
4. Propose numeric thresholds and a monthly false-positive target for owner
   approval. No automatic rejection is authorised. No accuracy target is approved
   by this file.
5. Inject provider timeouts, 403/429/5xx and malformed/incomplete results in the
   trusted test harness. Verify public memories cannot publish. Separately verify
   private-feedback outage behaviour against the approved policy.
6. Verify capacity at 74→75, 99→100, denied attempt 101 and midnight Sydney reset,
   including edits, feedback, retries and concurrent reservations. Verify pending
   items recover without exhausting retry counts while waiting for capacity.
7. Confirm warning-email receipt. A configured channel is not inbox evidence.
8. After approval permits controlled intake, exercise a genuine guest flow on
   Android/iPhone: submission, hold/review, publication, edit, delete, interrupted
   upload and feedback privacy. Record object-access denial and cleanup evidence.

Results ledger columns: case ID, label, actual verdict, provider scores, identity,
revision, timestamp, duration, error, cost units, mismatch explanation, reviewer.
Leave unexecuted rows marked NOT RUN.
