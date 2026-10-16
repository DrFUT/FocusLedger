import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, RefreshCw } from "lucide-react";
import QuietIconAction from "../../../shared/components/QuietIconAction.tsx";
import QuietButton from "../../../shared/components/QuietButton.tsx";
import QuietPageHeader from "../../../shared/components/QuietPageHeader.tsx";
import { useLocale, useLocaleText } from "../../../shared/i18n/index.ts";
import { loadDailyReview, readDemoMode, rememberDemoMode, type DailyReview as DailyReviewData } from "../services/dailyReviewService.ts";

const MINUTE = 60_000;
const localDayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const CATEGORY_KEYS = {
  Productivity: "productivity",
  Browser: "browser",
  Communication: "communication",
  Entertainment: "entertainment",
  Other: "other",
} as const;

export default function DailyReview() {
  const UI_TEXT = useLocaleText();
  const locale = useLocale();
  const [day, setDay] = useState(() => localDayStart(new Date()));
  const [demo, setDemo] = useState(readDemoMode);
  const [report, setReport] = useState<DailyReviewData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const formatDuration = useCallback((milliseconds: number) => {
    const minutes = Math.round(milliseconds / MINUTE);
    const hours = Math.floor(minutes / 60);
    return hours > 0
      ? `${hours} ${UI_TEXT.time.hours} ${minutes % 60} ${UI_TEXT.time.minutes}`
      : `${minutes} ${UI_TEXT.time.minutes}`;
  }, [UI_TEXT]);
  const formatPercent = useCallback((value: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value), [locale]);
  const formatClock = useCallback((timestamp: number) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(timestamp), [locale]);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(false);
    setReport(null);
    const start = new Date(day);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    try {
      const nextReport = await loadDailyReview(day, end.getTime(), demo);
      if (currentRequest === requestId.current) setReport(nextReport);
    } catch {
      if (currentRequest === requestId.current) setError(true);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [day, demo]);

  useEffect(() => {
    void refresh();
    return () => { requestId.current += 1; };
  }, [refresh]);

  const moveDay = (offset: number) => {
    const next = new Date(day);
    next.setDate(next.getDate() + offset);
    requestId.current += 1;
    setReport(null);
    setDay(next.getTime());
  };
  const dateLabel = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(day);
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const app of report?.apps ?? []) totals.set(app.category, (totals.get(app.category) ?? 0) + app.durationMs);
    return [...totals].sort((left, right) => right[1] - left[1]);
  }, [report]);
  const maxAppTime = Math.max(1, ...(report?.apps.map((app) => app.durationMs) ?? []));
  const timeDistribution = report ? [
    { label: UI_TEXT.dailyReview.workTime, duration: report.workMs, color: "var(--qp-accent-default)" },
    { label: UI_TEXT.dailyReview.inferredIdle, duration: report.inferredIdleMs, color: "var(--qp-text-secondary)" },
    { label: UI_TEXT.dailyReview.unobserved, duration: report.unobservedMs, color: "var(--qp-text-tertiary)" },
  ] : [];
  const elapsedMs = Math.max(1, timeDistribution.reduce((sum, item) => sum + item.duration, 0));

  const categoryLabel = (category: string) => {
    const key = CATEGORY_KEYS[category as keyof typeof CATEGORY_KEYS];
    return key ? UI_TEXT.dailyReview.category[key] : category;
  };
  const findingTitle = (kind: string) => {
    if (kind === "switching") return UI_TEXT.dailyReview.finding.switching;
    if (kind === "focus") return UI_TEXT.dailyReview.finding.focus;
    if (kind === "idle") return UI_TEXT.dailyReview.finding.idle;
    return UI_TEXT.dailyReview.finding.unknown;
  };
  const findingDetail = (finding: DailyReviewData["findings"][number]) => {
    if (finding.kind === "switching") return `${finding.evidenceCount} ${UI_TEXT.dailyReview.switchTransitions}`;
    if (finding.kind === "focus") return `${UI_TEXT.dailyReview.continuousPeriod}: ${formatDuration(finding.endMs - finding.startMs)}`;
    if (finding.kind === "idle") return `${UI_TEXT.dailyReview.inactiveGap}: ${formatDuration(finding.endMs - finding.startMs)}`;
    return formatDuration(finding.endMs - finding.startMs);
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto [&>*]:shrink-0" aria-label={UI_TEXT.dailyReview.title}>
      <QuietPageHeader icon={<CalendarDays size={18} />} title={UI_TEXT.dailyReview.navigation} subtitle={dateLabel} rightSlot={
        <div className="flex items-center gap-2">
          <QuietIconAction title={UI_TEXT.dailyReview.previousDay} icon={<ArrowLeft size={16} />} onClick={() => moveDay(-1)} />
          <QuietIconAction title={UI_TEXT.dailyReview.nextDay} icon={<ArrowRight size={16} />} onClick={() => moveDay(1)} disabled={day >= localDayStart(new Date())} />
          <QuietIconAction title={UI_TEXT.dailyReview.refresh} icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading} />
        </div>
      } />

      <div className="qp-panel flex flex-wrap items-center justify-between gap-3 p-3" role="status">
        <p className="text-sm text-[var(--qp-text-secondary)]">{demo ? UI_TEXT.dailyReview.demoNotice : UI_TEXT.dailyReview.realNotice}</p>
        <QuietButton size="compact" aria-pressed={demo} onClick={() => {
          requestId.current += 1;
          setReport(null);
          setError(false);
          setDemo(!demo);
          rememberDemoMode(!demo);
        }}>{demo ? UI_TEXT.dailyReview.showReal : UI_TEXT.dailyReview.showDemo}</QuietButton>
      </div>

      {error ? <div role="alert" className="rounded border border-[var(--qp-border)] p-4 text-sm text-[var(--qp-text-secondary)]">{UI_TEXT.dailyReview.loadFailed}</div> : null}
      {loading && !report ? <p className="text-sm text-[var(--qp-text-secondary)]">{UI_TEXT.dailyReview.loading}</p> : null}
      {!loading && !error && report && report.workMs === 0 ? <p className="text-sm text-[var(--qp-text-secondary)]">{UI_TEXT.dailyReview.noActivity}</p> : null}

      {report && report.workMs > 0 ? <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label={UI_TEXT.dailyReview.score} value={report.activityScore === null ? "—" : `${report.activityScore}`} suffix={report.activityScore === null ? "" : "/100"} detail={UI_TEXT.dailyReview.scoreFormula} />
          <Metric label={UI_TEXT.dailyReview.workTime} value={formatDuration(report.workMs)} />
          <Metric label={UI_TEXT.dailyReview.inferredIdle} value={formatDuration(report.inferredIdleMs)} detail={UI_TEXT.dailyReview.inferredIdleDetail} />
          <Metric label={UI_TEXT.dailyReview.unobserved} value={formatDuration(report.unobservedMs)} detail={UI_TEXT.dailyReview.unobservedDetail} />
        </div>

        <section className="qp-panel p-4" aria-labelledby="review-distribution-title">
          <h2 id="review-distribution-title" className="qp-text-section-title qp-weight-emphasis">{UI_TEXT.dailyReview.timeDistribution}</h2>
          <div className="mt-3 flex h-3 overflow-hidden rounded-sm" role="img" aria-label={timeDistribution.map((item) => `${item.label}: ${formatDuration(item.duration)}`).join(", ")}>
            {timeDistribution.map((item) => <div key={item.label} style={{ width: `${item.duration / elapsedMs * 100}%`, backgroundColor: item.color }} />)}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--qp-text-secondary)]">
            {timeDistribution.map((item) => <li key={item.label} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" />
              <span>{item.label}: {formatDuration(item.duration)} · {formatPercent(item.duration / elapsedMs)}</span>
            </li>)}
          </ul>
        </section>

        <div className="grid min-h-0 gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <section className="qp-panel min-w-0 p-4" aria-labelledby="review-category-title">
              <h2 id="review-category-title" className="qp-text-section-title qp-weight-emphasis">{UI_TEXT.dailyReview.categoryShare}</h2>
              <div className="mt-4 space-y-3">
                {categoryTotals.map(([category, durationMs]) => {
                  const share = durationMs / report.workMs;
                  return <div key={category}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span>{categoryLabel(category)}</span>
                      <span className="shrink-0 text-[var(--qp-text-secondary)]">{formatDuration(durationMs)} · {formatPercent(share)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-sm bg-[var(--qp-bg-elevated)]" role="img" aria-label={`${categoryLabel(category)} ${formatPercent(share)}`}>
                      <div className="h-full bg-[var(--qp-accent-default)]" style={{ width: `${Math.min(100, share * 100)}%` }} />
                    </div>
                  </div>;
                })}
              </div>
            </section>

            <section className="qp-panel min-w-0 p-4" aria-labelledby="review-apps-title">
              <h2 id="review-apps-title" className="qp-text-section-title qp-weight-emphasis">{UI_TEXT.dailyReview.appsTitle}</h2>
              <div className="mt-4 space-y-4">
                {report.apps.slice().sort((a, b) => b.durationMs - a.durationMs).map((app) => (
                  <div key={`${app.appName}-${app.category}`}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{app.appName}<span className="ml-2 text-xs text-[var(--qp-text-tertiary)]">{categoryLabel(app.category)}</span></span>
                      <span className="shrink-0 text-[var(--qp-text-secondary)]">{formatDuration(app.durationMs)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-sm bg-[var(--qp-bg-elevated)]"><div className="h-full bg-[var(--qp-accent-default)]" style={{ width: `${(app.durationMs / maxAppTime) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="qp-panel min-w-0 p-4" aria-labelledby="review-findings-title">
            <h2 id="review-findings-title" className="qp-text-section-title qp-weight-emphasis">{UI_TEXT.dailyReview.findingsTitle}</h2>
            {report.findings.length === 0 ? <p className="mt-4 text-sm text-[var(--qp-text-secondary)]">{UI_TEXT.dailyReview.noFindings}</p> :
              <ul className="mt-3 divide-y divide-[var(--qp-border)]">
                {report.findings.map((finding, index) => <li key={`${finding.kind}-${finding.startMs}-${index}`} className="py-3 first:pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="qp-text-group-title qp-weight-emphasis">{findingTitle(finding.kind)}</h3>
                    <time className="text-xs text-[var(--qp-text-tertiary)]">{formatClock(finding.startMs)}–{formatClock(finding.endMs)}</time>
                  </div>
                  <p className="mt-1 text-sm text-[var(--qp-text-secondary)]">{findingDetail(finding)}</p>
                </li>)}
              </ul>}
          </section>
        </div>
        <p className="text-xs text-[var(--qp-text-tertiary)]">{UI_TEXT.dailyReview.scoreDisclaimer}</p>
      </> : null}
    </section>
  );
}

function Metric({ label, value, suffix, detail }: { label: string; value: string; suffix?: string; detail?: string }) {
  return <div className="qp-panel min-w-0 p-3">
    <p className="text-xs text-[var(--qp-text-secondary)]">{label}</p>
    <p className="mt-2 break-words qp-text-metric qp-weight-emphasis text-[var(--qp-text-primary)]">{value}<span className="ml-1 text-xs qp-weight-regular text-[var(--qp-text-tertiary)]">{suffix}</span></p>
    {detail ? <p className="mt-1 text-xs text-[var(--qp-text-tertiary)]">{detail}</p> : null}
  </div>;
}
