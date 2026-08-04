import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const statusPath = resolve(root, "docs", "implementation-status.json");
const status = JSON.parse(readFileSync(statusPath, "utf8"));
const bop = readFileSync(resolve(root, status.authority), "utf8");
const allowed = new Set(status.statusDefinitions);
const allowedEvidenceLevels = new Set(status.evidenceLevels);
const seenWorkstreams = new Set();
const seenTasks = new Set();
const errors = [];

for (const workstream of status.workstreams) {
  if (seenWorkstreams.has(workstream.id)) errors.push(`Duplicate workstream: ${workstream.id}`);
  seenWorkstreams.add(workstream.id);
  if (!allowed.has(workstream.status)) errors.push(`Invalid status on ${workstream.id}: ${workstream.status}`);
  for (const bopRef of workstream.bopRefs) {
    if (!bop.includes(`[${bopRef}]`)) errors.push(`Unknown BOP reference on ${workstream.id}: ${bopRef}`);
  }
  for (const task of workstream.tasks) {
    if (seenTasks.has(task.id)) errors.push(`Duplicate task: ${task.id}`);
    seenTasks.add(task.id);
    if (!allowed.has(task.status)) errors.push(`Invalid status on ${task.id}: ${task.status}`);
    if (!allowedEvidenceLevels.has(task.evidenceLevel)) {
      errors.push(`Invalid evidence level on ${task.id}: ${task.evidenceLevel}`);
    }
    if (!task.verification) errors.push(`Missing verification command on ${task.id}`);
    if (!Array.isArray(task.evidence) || task.evidence.length === 0) {
      errors.push(`Missing evidence on ${task.id}`);
    } else {
      for (const evidence of task.evidence) {
        if (!existsSync(resolve(root, evidence))) errors.push(`Missing evidence file on ${task.id}: ${evidence}`);
      }
    }
  }
}

if (errors.length) {
  console.error("Implementation status validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const counts = status.workstreams
  .flatMap((workstream) => workstream.tasks)
  .reduce((summary, task) => {
    summary[task.status] = (summary[task.status] ?? 0) + 1;
    return summary;
  }, {});

const evidenceCounts = status.workstreams
  .flatMap((workstream) => workstream.tasks)
  .reduce((summary, task) => {
    summary[task.evidenceLevel] = (summary[task.evidenceLevel] ?? 0) + 1;
    return summary;
  }, {});

console.log(`Implementation status OK: ${status.workstreams.length} workstreams, ${seenTasks.size} tasks`);
console.log(JSON.stringify(counts, null, 2));
console.log("Evidence levels:");
console.log(JSON.stringify(evidenceCounts, null, 2));
