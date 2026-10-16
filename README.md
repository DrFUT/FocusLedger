# FocusLedger

A Windows **personal productivity review system based on local behavioral evidence**, derived from [Patina](https://github.com/Ceceliaee/patina). It turns foreground sessions into time distributions, explainable metrics and findings with evidence intervals. It preserves the upstream Windows foreground tracker and Tauri 2 / Rust / React architecture, and adds local SQLite daily analysis and a deterministic rule engine.

## Features

- Daily usage, foreground work time, inferred idle and unobserved time.
- Explainable Activity Score, time distribution, application ranking and category shares.
- A complete, clearly labeled demo on first launch, with a switch to real records and no synthetic database writes.
- Frequent application switching, prolonged continuous activity and long inactive gaps, with evidence time ranges.
- Existing history, classification, local backup/restore and desktop tools.

Single machine, SQLite storage, no account, cloud service or AI API. Automatic updates, WebDAV transfers and remote status connections are disabled in configuration and backend code. Persisted upstream settings cannot reactivate them. The optional browser activity bridge listens only on loopback; daily reviews use native foreground sessions.

## Development

Windows 10/11, WebView2 Runtime, Visual Studio C++ Build Tools, the Rust toolchain in [rust-toolchain.toml](rust-toolchain.toml), and Node/pnpm versions in [package.json](package.json) are required.

```powershell
pnpm install --frozen-lockfile
pnpm run tauri dev
```

First launch opens **Daily review** with a labeled synthetic full-day demo: five apps, category shares and all three rule types. Rust generates the sessions in memory and runs the same analysis engine with fixed default thresholds. Demo never inserts, deletes or replaces real records. Its full day can include future hours and is not evidence of actual behavior.

Select **Show real records** to review collected sessions; an empty real day shows an empty state. The choice is remembered locally. **Show demo data** returns to the example. Both modes support dates and refresh. System collection runs independently.

```powershell
pnpm run tauri build --no-bundle
pnpm run tauri build --bundles nsis
```

The first command creates `src-tauri/target/release/FocusLedger.exe` with embedded frontend assets; it requires WebView2 Runtime and runs without a development server. The second creates an installer in `src-tauri/target/release/bundle/nsis/`. Installing build dependencies requires network access; the application's tracking, reports and local backups work offline.

## Analysis contract

Work time is recorded foreground activity across all categories, including entertainment. It does not establish productive task time. Gaps of at least 20 minutes between sessions are inferred idle, rather than OS-measured idle. Other gaps are unobserved. Today's future hours are excluded.

Activity Score is `floor(work / (work + inferred idle) × 100)`, and is absent without observed data. It describes activity coverage rather than efficiency, productivity or concentration; entertainment contributes to foreground time too.

Idle currently comes from gaps between event-derived sessions. Pauses, lock and sleep can also cause gaps. Windows Idle API integration is not implemented; a future implementation could combine `GetLastInputInfo` evidence with session and power events.

Default rules: at least 12 transitions within 30 minutes; at least 90 minutes of continuous activity, allowing gaps up to 2 minutes; gaps of at least 20 minutes. Classification uses a transparent executable-name map. Unknown applications are Other.

[Architecture and rule semantics](docs/focusledger/architecture.md) describe the data flow, ownership, migration and limitations.

## Storage and compatibility

Internal crate names, identifiers and persistence formats retain Patina naming to preserve upstream data and backup compatibility. The default database is `%APPDATA%\Patina\patina.db`; development uses `%APPDATA%\Patina Dev\patina.db`. Actual paths are available in Settings.

Startup applies versioned SQLite migrations. Migration 17 adds the singleton `daily_review_rules` table without rewriting session facts. Reports are computed on demand rather than stored as duplicate snapshots.

## Validation

```powershell
pnpm run test:daily-review
pnpm run test:ui-browser-smoke --daily-review-only
pnpm run test:tauri-runtime-smoke --daily-review-only
pnpm run check:types
pnpm run check:lint
pnpm run check:i18n
pnpm run check:ipc-contracts
pnpm run check:architecture
pnpm run check:rust-boundaries
pnpm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib
```

Added tests cover scores, empty days, rule thresholds and finding ranges, day-boundary clipping, active sessions, overlap deduplication, migration idempotence/constraints and malformed IPC payloads. Existing upstream tracking, storage and restore tests remain available.

The focused browser test uses fixtures. The desktop test starts real WebView2 and verifies first-launch demo, data isolation, migration, analysis and offline IPC against an isolated SQLite database. See the [release validation report](docs/working/focusledger-release-validation.md) for final artifacts and gate limitations, and the [previous validation record](docs/working/focusledger-validation.md) for the earlier MVP evidence.

## Portfolio demonstration

Start with the labeled demo report and rule findings, explain Activity Score, then switch to real records and show collection and the history timeline. Explain the Windows → Rust → SQLite → Tauri IPC → React flow, the local-only runtime, and the tests for difficult time boundaries. Attribute the upstream collector and clearly distinguish the new analysis work.

See the [Chinese README](README.zh-CN.md) for a demonstration walkthrough. Derived from Patina under the [MIT License](LICENSE); upstream copyright notices are retained.
