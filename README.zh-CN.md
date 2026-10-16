# FocusLedger

基于 [Patina](https://github.com/Ceceliaee/patina) 二次开发的 Windows **本地行为证据驱动的效率复盘系统**。把前台应用会话转化为时间分布、可解释指标与带时间范围的行为发现，帮助个人回顾一天的活动。适合展示系统采集、SQLite 时间序列分析、规则引擎与 Tauri 桌面架构。

## MVP 能力

- 保留 Windows 前台窗口采集，以及 AFK、锁屏、休眠和会话恢复处理。
- 使用本机 SQLite 保存会话，按本地日期查询每日使用统计。
- 展示 Activity Score、工作时间、推断空闲、未观测时间、应用排行和分类占比。
- 首次启动直接展示完整 Demo 日报，可随时切换真实记录，演示数据不写入 SQLite。
- 检测高频应用切换、长时间连续工作和长时间空闲，每条发现显示对应时间范围。
- 保留本地备份恢复、历史时间轴、应用管理和轻量工具。

Tauri 2 + Rust + React + TypeScript。单机运行，无账号、云服务或 AI API。自动更新、WebDAV 和远程状态连接已禁用；已有远程配置也无法启用网络传输。可选的上游浏览器采集桥仅监听本机回环地址，日报只分析原生前台会话。

## 运行与构建

环境：Windows 10/11、WebView2 Runtime、Visual Studio C++ Build Tools、[Rust 工具链](rust-toolchain.toml)、[Node 版本](.node-version)及 [pnpm 版本](package.json)。

```powershell
pnpm install --frozen-lockfile
pnpm run tauri dev
```

首次启动进入「日报」，默认展示带有「演示数据」标识的合成完整一天，包括五个应用、分类分布和三类规则发现。Demo 在 Rust 内存中生成会话并运行同一分析引擎，使用固定默认阈值；不写入、删除或替换真实记录。演示中的完整一天可以包含今天尚未发生的时间，不能作为真实行为证据。

点击「查看真实记录」即可查看本机实际采集结果；选择会在本机保存，下次打开继续使用。真实模式没有记录时显示空状态。点击「查看演示数据」可重新演示；两个模式都支持日期切换和刷新。原有系统采集独立运行。

```powershell
pnpm run tauri build --no-bundle
pnpm run tauri build --bundles nsis
```

第一条命令生成 `src-tauri/target/release/FocusLedger.exe`，可直接运行，前端资源已嵌入，不需要开发服务器；机器需安装 WebView2 Runtime。第二条生成 `src-tauri/target/release/bundle/nsis/` 下的安装包。构建依赖安装需要网络；应用的采集、分析与本地备份可离线运行。

## 数据定义

工作时间指已记录的前台活动时间，包含所有应用类别。它不等同于生产性工作时长。会话之间至少 20 分钟的间隔记为「推断空闲」；其余空档及采集前后的时间记为「未观测」，今天尚未发生的时间不计入分布。

Activity Score 为 `floor(工作时间 / (工作时间 + 推断空闲) × 100)`，无观测数据时不评分。它反映活动覆盖比例，不等同于效率、生产力或真实专注程度，娱乐活动同样会计入前台时间。

当前 idle 基于事件所形成的会话间隔推断，停采、锁屏或睡眠也可能造成空档，尚未接入 Windows Idle API。未来可使用 `GetLastInputInfo` 采集系统输入空闲证据，再与会话和电源事件联合判断；本 MVP 未实现该能力。

默认规则：30 分钟内至少 12 次应用切换、连续活动至少 90 分钟、会话间隔至少 20 分钟。连续活动允许最多 2 分钟间隔。分类采用明确的可执行文件名称映射，未知应用归入「其他」。详见[架构与分析说明](docs/focusledger/architecture.md)。

## 本地存储与兼容

为保留原有数据及备份兼容性，内部 Cargo 名称、应用标识和持久化格式仍使用 Patina。默认数据库位于 `%APPDATA%\Patina\patina.db`；开发环境使用 `%APPDATA%\Patina Dev\patina.db`，避免写入正式数据。设置页可以查看实际路径和导出本地备份。

启动自动执行 SQLite 版本迁移，第 17 版增加 `daily_review_rules`，保留原始会话。日报按需计算，不另存重复的报表副本。升级前建议通过本地备份保存一份数据。

## 测试

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

新增测试覆盖评分、空数据、规则阈值与行为时间范围、跨日和活动会话裁剪、重叠去重、迁移幂等与约束、异常 IPC 数据。保留上游追踪、持久化和恢复测试。

日报 browser 测试使用 fixture；桌面测试启动真实 WebView2，在隔离的 SQLite 中验证首次 Demo、数据隔离、迁移、分析和离线 IPC。最终产物和门禁限制见[release 验证报告](docs/working/focusledger-release-validation.md)；上一阶段记录见[验证记录](docs/working/focusledger-validation.md)。

## 面试展示

1. 首次打开 Demo 日报，明确说明是合成数据，展示完整复盘。
2. 说明时间分布、分类占比及 Activity Score 公式，切回真实记录展示采集与历史时间轴。
3. 展示三类行为发现，解释时间范围及阈值。
4. 结合[架构说明](docs/focusledger/architecture.md)说明 Windows → Rust → SQLite → Tauri IPC → React 链路。
5. 展示测试与数据库迁移，说明跨日、重叠、空数据和离线边界。

可使用的项目描述：

> 我基于 Patina 二次开发了 FocusLedger，保留 Windows 系统事件与前台窗口采集能力，并实现了 SQLite 时间序列分析、可解释规则引擎及 Tauri 日报界面，形成一个完全本地运行的个人效率复盘系统。

项目基于 Patina，遵循 [MIT License](LICENSE)，保留上游版权声明。原有能力与新增分析模块的归属在展示时应明确说明。

[English](README.md)
