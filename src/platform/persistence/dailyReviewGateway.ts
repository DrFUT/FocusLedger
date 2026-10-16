import { invokeWithCommandError } from "./commandError.ts";
import { isFiniteNumber, isPlainRecord } from "../../shared/lib/runtimeTypeGuards.ts";

export interface DailyReview {
  dayStartMs: number;
  dayEndMs: number;
  activityScore: number | null;
  workMs: number;
  inferredIdleMs: number;
  unobservedMs: number;
  apps: Array<{ appName: string; category: string; durationMs: number }>;
  findings: Array<{ kind: string; startMs: number; endMs: number; evidenceCount: number }>;
}

const isNonNegativeInteger = (value: unknown): value is number => isFiniteNumber(value) && Number.isSafeInteger(value) && value >= 0;

function isDailyReview(value: unknown): value is DailyReview {
  if (!isPlainRecord(value)) return false;
  const { dayStartMs, dayEndMs } = value;
  return isNonNegativeInteger(dayStartMs)
    && isNonNegativeInteger(dayEndMs) && dayEndMs > dayStartMs
    && (value.activityScore === null || (isNonNegativeInteger(value.activityScore) && value.activityScore <= 100))
    && isNonNegativeInteger(value.workMs)
    && isNonNegativeInteger(value.inferredIdleMs)
    && isNonNegativeInteger(value.unobservedMs)
    && value.workMs + value.inferredIdleMs + value.unobservedMs <= dayEndMs - dayStartMs
    && Array.isArray(value.apps)
    && value.apps.every((app) => isPlainRecord(app)
      && typeof app.appName === "string"
      && typeof app.category === "string"
      && isNonNegativeInteger(app.durationMs))
    && value.apps.reduce((sum: number, app: { durationMs: number }) => sum + app.durationMs, 0) === value.workMs
    && Array.isArray(value.findings)
    && value.findings.every((finding) => isPlainRecord(finding)
      && typeof finding.kind === "string"
      && isNonNegativeInteger(finding.startMs) && finding.startMs >= dayStartMs
      && isNonNegativeInteger(finding.endMs) && finding.endMs > finding.startMs && finding.endMs <= dayEndMs
      && isNonNegativeInteger(finding.evidenceCount));
}

export function parseDailyReview(payload: unknown): DailyReview {
  if (!isDailyReview(payload)) throw new Error("Received invalid daily review payload");
  return payload;
}

export async function loadDailyReview(dayStartMs: number, dayEndMs: number, demo = false): Promise<DailyReview> {
  const payload: unknown = await invokeWithCommandError("cmd_get_daily_review", { dayStartMs, dayEndMs, demo });
  return parseDailyReview(payload);
}
