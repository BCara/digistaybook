import { setGlobalOptions } from "firebase-functions/v2";

// firebase-functions copies the global options into each function when it is
// defined, so this module must be the first import in index.ts. Set any later
// and it reaches only the functions declared after it.
//
// Every function runs as a dedicated service account, not the default compute
// account, which holds Editor. It is spelled out in full: the CLI expands a
// trailing-"@" shorthand for the function but not when granting secrets. The account
// must exist before a deploy, holding only what this code uses:
//   roles/datastore.user                   Firestore reads and writes
//   roles/storage.objectAdmin              guest media copy, read, delete
//   roles/secretmanager.secretAccessor     Stripe and report-hash secrets
//   roles/run.invoker                      Cloud Scheduler calling the workers
//   roles/serviceusage.serviceUsageConsumer  Vision and Natural Language calls
//   roles/logging.logWriter
// A new Google API or Firebase service needs its role added here and granted.
setGlobalOptions({ region: "australia-southeast1", serviceAccount: "functions-runtime@digistaybook-cbert.iam.gserviceaccount.com" });
