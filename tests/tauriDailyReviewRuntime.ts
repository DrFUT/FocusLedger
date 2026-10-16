import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { resolve, sep } from "node:path";
import { parseDailyReview } from "../src/platform/persistence/dailyReviewGateway.ts";
import { waitFor } from "./uiBrowserSmoke/browserHarness.ts";
import { verifyOfflineRuntime } from "./tauriOfflineRuntime.ts";
import type { StorageSnapshot } from "../src/platform/storage/storageRuntimeGateway.ts";

export async function verifyDailyReviewRuntime(evaluate: (expression: string) => Promise<unknown>, isolatedRoot: string) {
  const snapshot = await evaluate('window.__TAURI_INTERNALS__.invoke("cmd_get_storage_snapshot")') as StorageSnapshot;
  const databasePath = resolve(snapshot.paths.databasePath);
  assert.ok(databasePath.toLowerCase().startsWith(resolve(isolatedRoot).toLowerCase() + sep));
  const day = new Date();
  day.setDate(day.getDate() - 1);
  day.setHours(0, 0, 0, 0);
  const start = day.getTime();
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  const minute = 60_000;
  await waitFor("first launch demo", async () => evaluate('document.querySelector(\'[aria-label="每日复盘"]\')?.textContent?.includes("演示数据") && document.body.textContent.includes("Visual Studio Code")'), 15000);
  // Pause collection so session counts provide evidence that demo requests do
  // not insert synthetic rows into the real database.
  await evaluate('window.__TAURI_INTERNALS__.invoke("cmd_commit_app_settings", { mutations: [{ key: "tracking_paused", value: "1" }] })');
  const db = new DatabaseSync(databasePath);
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    assert.equal(db.prepare("SELECT MAX(version) AS version FROM _sqlx_migrations").get()?.version, 17);
    const before = db.prepare("SELECT COUNT(*) AS count FROM sessions").get()?.count;
    const demoPayload = await evaluate(`window.__TAURI_INTERNALS__.invoke("cmd_get_daily_review", { dayStartMs: ${start}, dayEndMs: ${next.getTime()}, demo: true })`);
    const demo = parseDailyReview(demoPayload);
    assert.equal(demo.activityScore, 75);
    assert.equal(demo.workMs, 328 * minute);
    assert.equal(demo.inferredIdleMs, 107 * minute);
    assert.equal(demo.apps.length, 5);
    assert.deepEqual(new Set(demo.findings.map(finding => finding.kind)), new Set(["focus", "idle", "switching"]));
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sessions").get()?.count, before);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE app_name IN ('Visual Studio Code','Microsoft Edge','Microsoft Word','Steam')").get()?.count, 0);
    const insert = db.prepare("INSERT INTO sessions(app_name,exe_name,window_title,start_time,end_time,duration) VALUES(?,?,'',?,?,?)");
    insert.run("FocusLedger fixture editor", "code.exe", start, start + 90 * minute, 90 * minute);
    insert.run("FocusLedger fixture browser", "chrome.exe", start + 120 * minute, start + 150 * minute, 30 * minute);
    for (let index = 0; index < 13; index += 1) {
      const begin = start + (150 + index) * minute;
      insert.run("Switch fixture", index % 2 ? "code.exe" : "chrome.exe", begin, begin + minute, minute);
    }
  } finally { db.close(); }
  const payload = await evaluate(`window.__TAURI_INTERNALS__.invoke("cmd_get_daily_review", { dayStartMs: ${start}, dayEndMs: ${next.getTime()} })`);
  const report = parseDailyReview(payload);
  assert.equal(report.workMs, 133 * minute);
  assert.equal(report.inferredIdleMs, 30 * minute);
  assert.equal(report.activityScore, 81);
  assert.deepEqual(new Set(report.findings.map(finding => finding.kind)), new Set(["focus", "idle", "switching"]));
  await evaluate(`document.querySelector('[data-sidebar-nav-item="daily-review"]')?.click()`);
  await waitFor("daily review page", async () => evaluate('Boolean(document.querySelector(\'[aria-label="每日复盘"]\'))'), 15000);
  await evaluate(`[...document.querySelectorAll('button')].find(node => node.textContent === '查看真实记录')?.click()`);
  await evaluate(`document.querySelector('button[aria-label="前一天"]')?.click()`);
  await waitFor("daily review fixture rendering", async () => evaluate('document.querySelector(\'[aria-label="每日复盘"]\')?.textContent?.includes("FocusLedger fixture editor")'), 15000);
  assert.equal(await evaluate('document.querySelector(\'[aria-label="每日复盘"]\')?.textContent?.includes("81")'), true);
  await verifyOfflineRuntime(evaluate);
  console.log("PASS first-launch demo, no demo SQLite writes, real migration, IPC, three rule findings and React date navigation");
}
