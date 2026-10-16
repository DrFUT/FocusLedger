use crate::commands::error::CommandErrorDto;
use crate::data::daily_review::{self, DailyReviewDto};
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn cmd_get_daily_review<R: Runtime>(
    day_start_ms: i64,
    day_end_ms: i64,
    demo: Option<bool>,
    app: AppHandle<R>,
) -> Result<DailyReviewDto, CommandErrorDto> {
    daily_review::load_daily_review(&app, day_start_ms, day_end_ms, demo.unwrap_or(false))
        .await
        .map_err(|error| CommandErrorDto::new("DAILY_REVIEW_FAILED", error, true))
}
