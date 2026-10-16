import assert from "node:assert/strict";
import { parseDailyReview } from "../src/platform/persistence/dailyReviewGateway.ts";

const report = {
  dayStartMs: 0, dayEndMs: 86_400_000, activityScore: 75,
  workMs: 5_400_000, inferredIdleMs: 1_800_000, unobservedMs: 79_200_000,
  apps: [{ appName: "Editor", category: "Productivity", durationMs: 5_400_000 }],
  findings: [{ kind: "idle", startMs: 5_400_000, endMs: 7_200_000, evidenceCount: 0 }],
};

assert.deepEqual(parseDailyReview(report), report);
assert.equal(parseDailyReview({ ...report, workMs: 0, inferredIdleMs: 0, unobservedMs: 86_400_000, activityScore: null, apps: [], findings: [] }).activityScore, null);
// A current day's future hours are deliberately absent from all three totals.
assert.equal(parseDailyReview({ ...report, unobservedMs: 0 }).workMs, 5_400_000);

for (const invalid of [
  null, {}, { ...report, activityScore: 101 }, { ...report, workMs: -1 },
  { ...report, inferredIdleMs: Number.NaN }, { ...report, dayEndMs: 0 },
  { ...report, unobservedMs: 86_400_000 }, { ...report, apps: [] },
  { ...report, findings: [{ ...report.findings[0], endMs: 86_400_001 }] },
  { ...report, findings: [{ ...report.findings[0], evidenceCount: 1.5 }] },
  { ...report, findings: [{ ...report.findings[0], endMs: 1 }] },
]) assert.throws(() => parseDailyReview(invalid), /invalid daily review payload/);

console.log("Daily review gateway: valid, empty, partial-day and malformed payload cases passed.");
