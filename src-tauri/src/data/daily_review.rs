use crate::data::sqlite_pool::wait_for_sqlite_pool;
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use tauri::{AppHandle, Runtime};

const MINUTE_MS: i64 = 60_000;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyReviewDto {
    pub day_start_ms: i64,
    pub day_end_ms: i64,
    pub activity_score: Option<u8>,
    pub work_ms: i64,
    pub inferred_idle_ms: i64,
    pub unobserved_ms: i64,
    pub apps: Vec<AppTimeDto>,
    pub findings: Vec<BehaviorFindingDto>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppTimeDto {
    pub app_name: String,
    pub category: String,
    pub duration_ms: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BehaviorFindingDto {
    pub kind: String,
    pub start_ms: i64,
    pub end_ms: i64,
    pub evidence_count: usize,
}

#[derive(Clone, Debug)]
struct SessionFact {
    app_name: String,
    exe_name: String,
    start_ms: i64,
    end_ms: i64,
}

#[derive(Clone, Copy)]
struct RuleConfig {
    switch_window_minutes: i64,
    switch_count_threshold: usize,
    focus_minutes_threshold: i64,
    idle_minutes_threshold: i64,
}

pub async fn load_daily_review<R: Runtime>(
    app: &AppHandle<R>,
    day_start_ms: i64,
    day_end_ms: i64,
    demo: bool,
) -> Result<DailyReviewDto, String> {
    if day_start_ms < 0
        || day_end_ms <= day_start_ms
        || day_end_ms - day_start_ms > 25 * 60 * MINUTE_MS
    {
        return Err("daily review range is invalid".to_string());
    }
    if demo {
        return Ok(demo_daily_review(day_start_ms, day_end_ms));
    }
    let pool = wait_for_sqlite_pool(app).await?;
    load_from_pool(
        &pool,
        day_start_ms,
        day_end_ms,
        chrono::Utc::now().timestamp_millis(),
    )
    .await
}

// Synthetic facts stay in memory: the production pool and tracker are never
// involved. Use the same analysis owner as real sessions, with fixed demo rules.
fn demo_daily_review(start: i64, end: i64) -> DailyReviewDto {
    let fact = |app: &str, exe: &str, from: i64, to: i64| SessionFact {
        app_name: app.into(),
        exe_name: exe.into(),
        start_ms: start.saturating_add(from * MINUTE_MS),
        end_ms: start.saturating_add(to * MINUTE_MS),
    };
    let mut sessions = vec![
        fact("Visual Studio Code", "code.exe", 540, 660),
        fact("Microsoft Edge", "msedge.exe", 690, 720),
    ];
    for index in 0..13 {
        let (app, exe) = if index % 2 == 0 {
            ("Visual Studio Code", "code.exe")
        } else {
            ("Microsoft Edge", "msedge.exe")
        };
        sessions.push(fact(app, exe, 720 + index, 721 + index));
    }
    sessions.extend([
        fact("Microsoft Teams", "teams.exe", 780, 810),
        fact("Microsoft Word", "winword.exe", 840, 960),
        fact("Steam", "steam.exe", 960, 975),
    ]);
    sessions.retain_mut(|session| {
        session.end_ms = session.end_ms.min(end);
        session.start_ms < session.end_ms
    });
    analyze_day(
        start,
        end,
        &sessions,
        RuleConfig {
            switch_window_minutes: 30,
            switch_count_threshold: 12,
            focus_minutes_threshold: 90,
            idle_minutes_threshold: 20,
        },
    )
}

async fn load_from_pool(
    pool: &SqlitePool,
    day_start_ms: i64,
    day_end_ms: i64,
    now_ms: i64,
) -> Result<DailyReviewDto, String> {
    let observed_end_ms = day_end_ms.min(now_ms).max(day_start_ms);
    let config_row = sqlx::query(
        "SELECT switch_window_minutes, switch_count_threshold, focus_minutes_threshold, idle_minutes_threshold
         FROM daily_review_rules WHERE id = 1",
    )
    .fetch_one(pool)
    .await
    .map_err(|error| format!("failed to read daily review rules: {error}"))?;
    let rules = RuleConfig {
        switch_window_minutes: config_row.get("switch_window_minutes"),
        switch_count_threshold: config_row.get::<i64, _>("switch_count_threshold") as usize,
        focus_minutes_threshold: config_row.get("focus_minutes_threshold"),
        idle_minutes_threshold: config_row.get("idle_minutes_threshold"),
    };
    let rows = sqlx::query(
        "SELECT app_name, exe_name, MAX(start_time, ?) start_ms,
                MIN(COALESCE(end_time, ?), ?) end_ms
         FROM sessions
         WHERE start_time < ? AND COALESCE(end_time, ?) > ?
         ORDER BY start_time, id",
    )
    .bind(day_start_ms)
    .bind(observed_end_ms)
    .bind(observed_end_ms)
    .bind(observed_end_ms)
    .bind(observed_end_ms)
    .bind(day_start_ms)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("failed to read daily sessions: {error}"))?;
    let sessions = rows
        .into_iter()
        .filter_map(|row| {
            let start_ms: i64 = row.get("start_ms");
            let end_ms: i64 = row.get("end_ms");
            (end_ms > start_ms).then(|| SessionFact {
                app_name: row.get("app_name"),
                exe_name: row.get("exe_name"),
                start_ms,
                end_ms,
            })
        })
        .collect::<Vec<_>>();
    // Foreground intervals are exclusive. Old or recovered overlapping rows
    // must not inflate the day's duration; the earlier row owns the overlap.
    let mut covered_until = day_start_ms;
    let sessions = sessions
        .into_iter()
        .filter_map(|mut session| {
            session.start_ms = session.start_ms.max(covered_until);
            covered_until = covered_until.max(session.end_ms);
            (session.end_ms > session.start_ms).then_some(session)
        })
        .collect::<Vec<_>>();
    Ok(analyze_day(day_start_ms, observed_end_ms, &sessions, rules).with_day_end(day_end_ms))
}

impl DailyReviewDto {
    fn with_day_end(mut self, day_end_ms: i64) -> Self {
        self.day_end_ms = day_end_ms;
        self
    }
}

fn analyze_day(
    start: i64,
    end: i64,
    sessions: &[SessionFact],
    rules: RuleConfig,
) -> DailyReviewDto {
    let mut app_totals = std::collections::BTreeMap::<(String, String), i64>::new();
    let mut work_ms = 0;
    let mut inferred_idle_ms = 0;
    let mut unobserved_ms = if sessions.is_empty() { end - start } else { 0 };
    let mut findings = Vec::new();
    let idle_limit = rules.idle_minutes_threshold * MINUTE_MS;
    let mut previous_end = None;
    let mut focus_start = None;
    let mut focus_end = None;
    let mut focus_count = 0usize;

    for session in sessions {
        let duration = session.end_ms.saturating_sub(session.start_ms).max(0);
        if duration == 0 {
            continue;
        }
        if let Some(prior_end) = previous_end {
            let gap = session.start_ms.saturating_sub(prior_end).max(0);
            if gap >= idle_limit {
                inferred_idle_ms += gap;
                findings.push(BehaviorFindingDto {
                    kind: "idle".into(),
                    start_ms: prior_end,
                    end_ms: session.start_ms,
                    evidence_count: 0,
                });
            } else if gap > 0 {
                unobserved_ms += gap;
            }
            if gap <= 2 * MINUTE_MS {
                focus_end = Some(focus_end.unwrap_or(session.end_ms).max(session.end_ms));
                focus_count += 1;
            } else {
                push_focus_finding(
                    &mut findings,
                    focus_start,
                    focus_end,
                    focus_count,
                    rules.focus_minutes_threshold,
                );
                focus_start = Some(session.start_ms);
                focus_end = Some(session.end_ms);
                focus_count = 1;
            }
        } else {
            unobserved_ms += session.start_ms.saturating_sub(start).max(0);
            focus_start = Some(session.start_ms);
            focus_end = Some(session.end_ms);
            focus_count = 1;
        }
        work_ms += duration;
        let category = app_category(&session.exe_name);
        *app_totals
            .entry((session.app_name.clone(), category))
            .or_default() += duration;
        previous_end = Some(previous_end.unwrap_or(session.end_ms).max(session.end_ms));
    }
    if let Some(last_end) = previous_end {
        unobserved_ms += end.saturating_sub(last_end).max(0);
    }
    push_focus_finding(
        &mut findings,
        focus_start,
        focus_end,
        focus_count,
        rules.focus_minutes_threshold,
    );
    findings.extend(detect_switch_bursts(sessions, rules));
    findings.sort_by_key(|finding| finding.start_ms);

    let observed_total = work_ms.saturating_add(inferred_idle_ms);
    let activity_score = if observed_total == 0 {
        None
    } else {
        Some(((work_ms * 100 / observed_total).clamp(0, 100)) as u8)
    };
    let apps = app_totals
        .into_iter()
        .map(|((app_name, category), duration_ms)| AppTimeDto {
            app_name,
            category,
            duration_ms,
        })
        .collect();
    DailyReviewDto {
        day_start_ms: start,
        day_end_ms: end,
        activity_score,
        work_ms,
        inferred_idle_ms,
        unobserved_ms,
        apps,
        findings,
    }
}

fn push_focus_finding(
    findings: &mut Vec<BehaviorFindingDto>,
    start: Option<i64>,
    end: Option<i64>,
    count: usize,
    threshold_minutes: i64,
) {
    if let (Some(start_ms), Some(end_ms)) = (start, end) {
        if end_ms.saturating_sub(start_ms) >= threshold_minutes * MINUTE_MS {
            findings.push(BehaviorFindingDto {
                kind: "focus".into(),
                start_ms,
                end_ms,
                evidence_count: count,
            });
        }
    }
}

fn detect_switch_bursts(sessions: &[SessionFact], rules: RuleConfig) -> Vec<BehaviorFindingDto> {
    let window_ms = rules.switch_window_minutes * MINUTE_MS;
    let mut findings = Vec::new();
    let mut transitions = std::collections::VecDeque::<(i64, i64)>::new();
    for pair in sessions.windows(2) {
        let previous = &pair[0];
        let next = &pair[1];
        if next.start_ms - previous.end_ms > 2 * MINUTE_MS {
            transitions.clear();
            continue;
        }
        while transitions
            .front()
            .is_some_and(|(time, _)| next.start_ms - time > window_ms)
        {
            transitions.pop_front();
        }
        if !next.exe_name.eq_ignore_ascii_case(&previous.exe_name) {
            transitions.push_back((next.start_ms, previous.start_ms));
        }
        if transitions.len() >= rules.switch_count_threshold {
            findings.push(BehaviorFindingDto {
                kind: "switching".into(),
                start_ms: transitions.front().unwrap().1,
                end_ms: next.end_ms,
                evidence_count: transitions.len(),
            });
            transitions.clear();
        }
    }
    findings
}

fn app_category(exe_name: &str) -> String {
    let name = exe_name
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(exe_name)
        .to_ascii_lowercase();
    if [
        "code.exe",
        "devenv.exe",
        "idea64.exe",
        "notepad++.exe",
        "winword.exe",
        "excel.exe",
        "powerpnt.exe",
    ]
    .iter()
    .any(|app| name == *app)
    {
        "Productivity".into()
    } else if ["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe"]
        .iter()
        .any(|app| name == *app)
    {
        "Browser".into()
    } else if [
        "slack.exe",
        "teams.exe",
        "discord.exe",
        "wechat.exe",
        "qq.exe",
    ]
    .iter()
    .any(|app| name == *app)
    {
        "Communication".into()
    } else if ["steam.exe", "spotify.exe", "vlc.exe"]
        .iter()
        .any(|app| name == *app)
    {
        "Entertainment".into()
    } else {
        "Other".into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::Executor;

    #[test]
    fn demo_runs_real_rules_and_covers_a_full_day_without_storage() {
        for hours in [23, 24, 25] {
            let start = 1_700_000_000_000;
            let end = start + hours * 60 * MINUTE_MS;
            let report = demo_daily_review(start, end);
            assert_eq!(report.work_ms, 328 * MINUTE_MS);
            assert_eq!(report.inferred_idle_ms, 107 * MINUTE_MS);
            assert_eq!(report.activity_score, Some(75));
            assert_eq!(
                report.work_ms + report.inferred_idle_ms + report.unobserved_ms,
                end - start
            );
            assert_eq!(report.apps.len(), 5);
            for kind in ["focus", "idle", "switching"] {
                assert!(report.findings.iter().any(|finding| finding.kind == kind));
            }
            assert!(report
                .findings
                .iter()
                .all(|finding| finding.start_ms >= start && finding.end_ms <= end));
        }
        let short = demo_daily_review(0, MINUTE_MS);
        assert_eq!(short.work_ms, 0);
        assert_eq!(short.activity_score, None);
        assert_eq!(short.unobserved_ms, MINUTE_MS);
        let extreme = demo_daily_review(i64::MAX - MINUTE_MS, i64::MAX);
        assert_eq!(extreme.work_ms, 0);
        assert_eq!(extreme.unobserved_ms, MINUTE_MS);
    }

    fn session(app: &str, start: i64, end: i64) -> SessionFact {
        SessionFact {
            app_name: app.into(),
            exe_name: app.into(),
            start_ms: start,
            end_ms: end,
        }
    }
    fn rules() -> RuleConfig {
        RuleConfig {
            switch_window_minutes: 30,
            switch_count_threshold: 3,
            focus_minutes_threshold: 90,
            idle_minutes_threshold: 20,
        }
    }

    #[test]
    fn calculates_daily_usage_and_marks_gaps_as_inferred_idle() {
        let day = 24 * 60 * MINUTE_MS;
        let sessions = [
            session("code.exe", 60 * MINUTE_MS, 120 * MINUTE_MS),
            session("chrome.exe", 150 * MINUTE_MS, 180 * MINUTE_MS),
        ];
        let report = analyze_day(0, day, &sessions, rules());
        assert_eq!(report.work_ms, 90 * MINUTE_MS);
        assert_eq!(report.inferred_idle_ms, 30 * MINUTE_MS);
        assert_eq!(
            report.work_ms + report.inferred_idle_ms + report.unobserved_ms,
            day
        );
        assert_eq!(report.activity_score, Some(75));
        assert_eq!(report.apps.len(), 2);
        assert_eq!(report.findings[0].kind, "idle");
    }

    #[test]
    fn leaves_activity_score_empty_when_the_day_has_no_sessions() {
        let report = analyze_day(0, 24 * 60 * MINUTE_MS, &[], rules());
        assert_eq!(report.activity_score, None);
        assert!(report.apps.is_empty());
        assert!(report.findings.is_empty());
        assert_eq!(report.unobserved_ms, 24 * 60 * MINUTE_MS);
    }

    #[test]
    fn detects_focus_with_precise_ranges() {
        let sessions = [
            session("a.exe", 0, 31 * MINUTE_MS),
            session("b.exe", 31 * MINUTE_MS, 62 * MINUTE_MS),
            session("a.exe", 62 * MINUTE_MS, 93 * MINUTE_MS),
            session("b.exe", 93 * MINUTE_MS, 124 * MINUTE_MS),
        ];
        let report = analyze_day(0, 200 * MINUTE_MS, &sessions, rules());
        assert!(report.findings.iter().any(|finding| finding.kind == "focus"
            && finding.start_ms == 0
            && finding.end_ms == 124 * MINUTE_MS));
        assert!(!report
            .findings
            .iter()
            .any(|finding| finding.kind == "switching"));
    }

    #[test]
    fn detects_multiple_switch_bursts_without_duplicate_windows() {
        let sessions = (0..8)
            .map(|index| {
                session(
                    if index % 2 == 0 { "a.exe" } else { "b.exe" },
                    index * 5 * MINUTE_MS,
                    (index + 1) * 5 * MINUTE_MS,
                )
            })
            .collect::<Vec<_>>();
        let mut burst_rules = rules();
        burst_rules.switch_count_threshold = 3;
        let findings = detect_switch_bursts(&sessions, burst_rules);
        assert_eq!(findings.len(), 2);
        assert_eq!(findings[0].start_ms, 0);
        assert_eq!(findings[0].end_ms, 20 * MINUTE_MS);
        assert_eq!(findings[0].evidence_count, 3);
        assert_eq!(findings[1].start_ms, 15 * MINUTE_MS);
        assert_eq!(findings[1].end_ms, 35 * MINUTE_MS);
    }

    #[test]
    fn excludes_repeated_apps_and_switches_separated_by_long_gaps() {
        let sessions = [
            session("Code.exe", 0, 5 * MINUTE_MS),
            session("code.exe", 5 * MINUTE_MS, 10 * MINUTE_MS),
            session("b.exe", 10 * MINUTE_MS, 15 * MINUTE_MS),
            session("a.exe", 20 * MINUTE_MS, 25 * MINUTE_MS),
            session("b.exe", 25 * MINUTE_MS, 30 * MINUTE_MS),
        ];
        assert!(detect_switch_bursts(&sessions, rules()).is_empty());
        assert_eq!(app_category("C:\\Apps\\CODE.EXE"), "Productivity");
        assert_eq!(app_category("mycode.exe"), "Other");
    }

    #[test]
    fn includes_exact_idle_threshold_and_breaks_continuous_work() {
        let sessions = [
            session("a.exe", 0, 45 * MINUTE_MS),
            session("b.exe", 65 * MINUTE_MS, 110 * MINUTE_MS),
        ];
        let review = analyze_day(0, 120 * MINUTE_MS, &sessions, rules());
        assert_eq!(review.inferred_idle_ms, 20 * MINUTE_MS);
        assert_eq!(review.unobserved_ms, 10 * MINUTE_MS);
        assert_eq!(review.findings.len(), 1);
        assert_eq!(review.findings[0].kind, "idle");
    }

    #[tokio::test]
    async fn daily_query_clips_cross_midnight_and_active_sessions() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        pool.execute("CREATE TABLE sessions(id INTEGER PRIMARY KEY, app_name TEXT NOT NULL, exe_name TEXT NOT NULL, start_time INTEGER NOT NULL, end_time INTEGER, duration INTEGER)").await.unwrap();
        pool.execute(crate::data::schema::DAILY_REVIEW_RULES_SCHEMA_SQL)
            .await
            .unwrap();
        sqlx::query("INSERT INTO sessions(app_name, exe_name, start_time, end_time) VALUES ('Editor','code.exe',?,NULL)")
            .bind(10 * MINUTE_MS).execute(&pool).await.unwrap();
        let review = load_from_pool(&pool, 20 * MINUTE_MS, 40 * MINUTE_MS, 30 * MINUTE_MS)
            .await
            .unwrap();
        assert_eq!(review.work_ms, 10 * MINUTE_MS);
        assert_eq!(review.apps[0].duration_ms, 10 * MINUTE_MS);
        pool.close().await;
    }

    #[tokio::test]
    async fn daily_query_deduplicates_overlaps_and_clips_both_day_boundaries() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        pool.execute("CREATE TABLE sessions(id INTEGER PRIMARY KEY, app_name TEXT NOT NULL, exe_name TEXT NOT NULL, start_time INTEGER NOT NULL, end_time INTEGER)").await.unwrap();
        pool.execute(crate::data::schema::DAILY_REVIEW_RULES_SCHEMA_SQL)
            .await
            .unwrap();
        for (app, start, end) in [
            ("code.exe", 0, 30),
            ("chrome.exe", 20, 40),
            ("code.exe", 25, 28),
            ("vlc.exe", 45, 80),
        ] {
            sqlx::query(
                "INSERT INTO sessions(app_name,exe_name,start_time,end_time) VALUES (?,?,?,?)",
            )
            .bind(app)
            .bind(app)
            .bind(start * MINUTE_MS)
            .bind(end * MINUTE_MS)
            .execute(&pool)
            .await
            .unwrap();
        }
        let report = load_from_pool(&pool, 10 * MINUTE_MS, 60 * MINUTE_MS, 100 * MINUTE_MS)
            .await
            .unwrap();
        assert_eq!(report.work_ms, 45 * MINUTE_MS);
        assert_eq!(report.unobserved_ms, 5 * MINUTE_MS);
        assert_eq!(
            report.apps.iter().map(|app| app.duration_ms).sum::<i64>(),
            report.work_ms
        );
        assert_eq!(report.apps.len(), 3);
        assert_eq!(report.day_end_ms, 60 * MINUTE_MS);
        pool.close().await;
    }

    #[tokio::test]
    async fn rule_migration_is_idempotent_preserves_settings_and_rejects_invalid_thresholds() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        let sql = crate::data::schema::DAILY_REVIEW_RULES_SCHEMA_SQL;
        pool.execute(sql).await.unwrap();
        pool.execute("UPDATE daily_review_rules SET switch_count_threshold=15 WHERE id=1")
            .await
            .unwrap();
        pool.execute(sql).await.unwrap();
        assert_eq!(
            sqlx::query_scalar::<_, i64>(
                "SELECT switch_count_threshold FROM daily_review_rules WHERE id=1"
            )
            .fetch_one(&pool)
            .await
            .unwrap(),
            15
        );
        assert!(pool
            .execute("UPDATE daily_review_rules SET idle_minutes_threshold=0")
            .await
            .is_err());
        assert!(pool
            .execute("INSERT INTO daily_review_rules(id) VALUES(2)")
            .await
            .is_err());
        pool.close().await;
    }
}
