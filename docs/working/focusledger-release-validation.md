# FocusLedger 冻结版本 release 验证报告

验证日期：2026-10-14（Asia/Shanghai）。目标平台：Windows x64，内部版本 `1.9.10`。功能冻结后的本轮仅修改文档位置、引用及验证报告，未修改应用源码、测试、评分定义、依赖或锁文件。当前结论为 **BLOCKED：尚不满足正式发布验收**；以下本轮状态优先于历史记录。

## GitHub 源码发布附录（2026-10-16）

本附录记录后续的源码基线，不覆盖上面的冻结验证结论：源码副本已初始化本地 Git 仓库，默认分支为 `main`，首次提交为 `36e1d61`（`feat: release FocusLedger MVP`）。提交前复查了 `.gitignore`、暂存区路径和文件名，未纳入 `node_modules`、`dist`、Rust `target`、`artifacts`、本地 SQLite、环境变量文件、日志、安装包或可识别的真实活动数据；通用 SQLite、环境变量和构建产物规则已加入忽略配置。文档治理、TypeScript 检查、Vite 生产构建和 `cargo check --locked` 均通过。

GitHub CLI 未安装，Git Credential Manager 未返回 `github.com` 凭据，环境变量中没有 GitHub Token；直接访问 GitHub API 也被当前网络策略拒绝。因此尚未创建或确认远程仓库、尚未配置 `origin`、尚未推送。该门禁保持 **BLOCKED**，不能据此声称 GitHub 仓库已发布。

## 冻结后的工程复核

上一阶段未完成项为 Git 文档门禁、cargo-audit 依赖审计、干净机器安装/卸载、ARM64 和签名证据。审查上游发布政策后，还需区分本地 x64 产物与其双架构、tag、签名、资产校验及 attestation 发布链；本轮没有执行外部发布。

修改前 `git status --short` 返回 128：此源码副本没有 `.git`，无法提供 Git diff 或发布 tag 来源证据。先保存了 1,353 个源码/配置/文档文件及其逐文件摘要，并复制了上一轮 exe 和安装包。恢复材料位于 [source-before.zip](../../artifacts/release-freeze-20261014/source-before.zip) 和[旧产物清单](../../artifacts/release-freeze-20261014/artifacts-before.json)，不包含用户数据库。

| 门禁 | 状态 | 本轮证据与判定范围 |
| --- | --- | --- |
| 源码与可恢复性 | PASS | 修改前快照、旧产物副本均已保留；[文件变更清单](../../artifacts/release-freeze-20261014/source-changes.json)只含文档调整；未结束用户应用进程，未操作其数据 |
| 文档数量、UTF-8、链接与锚点补充检查 | PASS | 现有治理函数的文件系统扫描发现顶层文档 11/10；仅将架构说明移动到 `docs/focusledger/architecture.md` 并修正引用，复查 22 份文档、顶层 10/10、0 错误；[修复前](../../artifacts/release-freeze-20261014/docs-diagnostic-before.json)、[修复后](../../artifacts/release-freeze-20261014/docs-diagnostic-after.json) |
| 正式 Git 文档门禁 / `release:check` | BLOCKED | [实际执行日志](../../artifacts/release-freeze-20261014/release-check.stderr.log)记录退出码 1，停在 `git ls-files -z --cached --others --exclude-standard -- *.md`；Git 返回 128，缺少仓库元数据。未初始化 Git 或改写检查器，补充扫描不冒充正式通过 |
| Rust 质量与测试 | PASS | `pnpm run check:rust` 退出码 0；858 passed、4 ignored，另有 6 项集成测试通过；fmt、check、Clippy `-D warnings`、边界及自测通过；[日志](../../artifacts/release-freeze-20261014/rust.stdout.log)、[执行结果](../../artifacts/release-freeze-20261014/rust.result.json) |
| 前端静态门禁 | PASS | 类型、lint、命名、架构、IPC、热点、Quiet Pro、测试治理及对应自测通过；toolchain、i18n、文档自测在 `release:check` 停止前通过；[静态日志](../../artifacts/release-freeze-20261014/frontend-static.stdout.log) |
| 前端测试 / 覆盖率 / 变异 | PASS | `pnpm run check:tests` 退出码 0；现有快速测试通过，风险域 lines 97.44%、functions 95.65%、branches 90.46%，逐文件阈值通过，27/27 变异被杀死；[完整日志](../../artifacts/release-freeze-20261014/frontend-tests.stdout.log) |
| 真实浏览器回归 | PASS | 同一 `check:tests` 日志记录 165 项通过，包含首次 Demo、来源切换、日期与四语言场景 |
| Windows Tauri 日报专项 | PASS | 隔离 SQLite 和真实 WebView2 验证首次 Demo、无演示写入、migration 17、真实日报及离线 IPC；[日志](../../artifacts/release-freeze-20261014/tauri-runtime.stdout.log)、[退出码 0](../../artifacts/release-freeze-20261014/tauri-runtime.result.json)。仅为开发环境 runtime，不是安装验收 |
| 原始 Cargo.lock 全量审计 | FAIL | 实际 cargo-audit 返回 1：3 条漏洞及 1 条 unsound 公告；均属于既有精确例外，未隐去原始失败。另有维护状态及 yanked 警告，见下节 |
| Windows 产品依赖审计门禁 | PASS | 原有 `pnpm run check:dependencies` 在明确的官方公告库配置下退出 0；4 条精确例外在两个 Windows 目标上均验证不可达，无额外漏洞/unsound 发现；pnpm 公告计数全为 0；[日志](../../artifacts/release-freeze-20261014/dependencies-official-db.stdout.log) |
| 版本文件 / changelog 结构 | PASS | `release:validate-version-files 1.9.10`、`release:validate-changelog` 均退出 0；[版本结果](../../artifacts/release-freeze-20261014/version.result.json)、[changelog 结果](../../artifacts/release-freeze-20261014/changelog.result.json)。未取得 Git 发布基线，不能据此声称 changelog 的完整发布范围已验证 |
| Windows x64 Release / NSIS | PASS | `pnpm run tauri build --bundles nsis` 的实际构建子进程退出 0；[构建结果](../../artifacts/release-freeze-20261014/release-build.result.json)、[打包日志](../../artifacts/release-freeze-20261014/release-build.stderr.log)；未启动或安装产物 |
| 前端 bundle 预算 | PASS | `check:bundle` 退出 0；initial 199.63 KiB、total 387.67 KiB gzip；[日志](../../artifacts/release-freeze-20261014/bundle.stdout.log)。本轮未调整预算 |
| 产物路径 / SHA-256 / PE | PASS | 从最终磁盘文件计算并核对；主程序 PE 为 x64 `0x8664`，NSIS 引导程序 PE 为 x86 `0x14c`，后者不代表应用架构错误；[最终清单](../../artifacts/release-freeze-20261014/artifacts-final.json) |
| 干净 Windows 安装 / 卸载 | BLOCKED | 未提供可用干净虚拟机；Windows Sandbox 文件不存在，未发现 Hyper-V / VMware / VirtualBox / QEMU 的可用控制工具或 Hyper-V 服务；[环境探测](../../artifacts/release-freeze-20261014/clean-environment.stdout.log)。现有安装包未执行；首次安装、普通用户权限、WebView2 缺失、重启、卸载与数据保留均未验证 |
| Windows Authenticode | FAIL | 现有 exe 和 NSIS 安装包实际状态均为 `NotSigned`；[签名检查](../../artifacts/release-freeze-20261014/artifact-signatures-final.stdout.log)。SHA-256 不能代替发布者签名 |
| 上游正式发布资产链 | BLOCKED | 尚无候选 Git/tag 基线、ARM64 构建及安装证据、双架构签名资产、独立 release asset 校验和 attestation；未生成 updater manifest 或执行外部发布。当前离线 FocusLedger 的 updater 已禁用，未为套用上游流程改变该行为 |

上述 PASS 仅覆盖对应证据；`release:check` 和正式发布总体仍为 BLOCKED。恢复真实 Git 工作区后需重新执行正式文档与发布入口，取得干净 Windows 安装验收，并明确签名和目标架构的正式发行要求。

## 依赖审计证据

安装 `cargo-audit 0.22.2` 到工作区工具目录 `D:/codex_work/.tools/cargo-audit`，未升级项目依赖。最初沙箱内访问 registry 失败，允许网络后工具安装成功。默认公告库拉取仍出现 Git pack / IO 错误，见[首次审计错误](../../artifacts/release-freeze-20261014/cargo-audit.stderr.log)和[默认依赖门禁错误](../../artifacts/release-freeze-20261014/dependencies.stderr.log)。

通过 Git CLI 从 `https://github.com/RustSec/advisory-db.git` 成功浅克隆到 `D:/codex_work/.tools/rustsec-advisory-db`，提交为 `22908666e50caf5d9fe40e13edab0d34bddcbaef`，工作区干净；[提交证据](../../artifacts/release-freeze-20261014/rustsec-revision-verified.stdout.log)。数据库含 1,310 条公告，实际执行：

```powershell
cargo audit --file src-tauri/Cargo.lock --db D:/codex_work/.tools/rustsec-advisory-db --no-fetch --json
```

[原始 JSON](../../artifacts/release-freeze-20261014/cargo-audit-official-db.stdout.log)未过滤漏洞，结果如下。`--no-fetch` 使用本轮刚下载的官方数据库，未使用 `--stale` 或新增 ignore。

| 公告 | 锁定依赖 | 原有门禁的 Windows 不可达性 |
| --- | --- | --- |
| RUSTSEC-2026-0194、RUSTSEC-2026-0195 | `quick-xml@0.39.4` | Linux Wayland scanner 路径，不进入两个 Windows 产品依赖图 |
| RUSTSEC-2023-0071 | `rsa@0.9.10` | SQLite-only 配置未启用 SQLx 的可选 RSA 依赖；公告无已发布补丁 |
| RUSTSEC-2024-0429（unsound） | `glib@0.18.5` | GTK 路径，不进入两个 Windows 产品依赖图 |

原有脚本逐项执行 `cargo tree --target <Windows target> --locked -i <crate@version>`，并拒绝新增或过期例外。本轮仅临时使用 `.cargo/audit.toml` 指向同一个官方 checkout 且设置 `fetch = false`，使原有完整门禁能够执行；完成后删除临时项目配置，配置副本保存在[证据目录](../../artifacts/release-freeze-20261014/audit.toml)。未修改 `scripts/audit-dependencies.ts`、例外集合或阈值。

保留风险：原始审计还有 7 条 unmaintained 警告（`paste`、`proc-macro-error` 和 5 个 `unic-*` crate）及 `chacha20@0.10.1` 的 yanked 警告；现有门禁没有将这两类警告升级为失败，不能将 PASS 描述为依赖完全无风险。未为消除告警进行依赖升级。Cargo.lock 与 pnpm-lock 的 SHA-256 分别仍为 `6bb0c6826d58510c6e9218fca7f7fa2c455bcbb96e4e48526f9ad71da3744014`、`65aa88e365d4c579632e4fe1567f9a3cb1fc36fdbb4f3490df0d7bac2dfeeb44`。

## 待补的干净安装证据

必须在可重置的干净 Windows 10/11 x64 环境，以本报告记录摘要的 NSIS 安装包验收普通用户安装、自定义安装目录及 WebView2 已安装/缺失场景；确认首次 Demo、切换真实采集、退出重开、卸载后的用户数据保留。旧版自定义目录升级需另用干净快照验证。当前开发机测试均不计入这些项目，也未为测试改动主机系统功能或用户数据库。

## 交付范围

- 首次启动默认进入日报并显示明确标识的 Demo，可切换真实记录，并保存本机选择。
- Demo 在 Rust 内存中生成五个应用的合成会话，复用真实日报的分析引擎，使用固定默认规则。不会向 SQLite 写入演示数据，不需要新迁移；现有 migration 17 保留。
- 四语言评分统一为 Activity Score，IPC 字段统一为 `activityScore`。它描述活动覆盖比例，不承诺效率、生产力或真实专注程度。
- 中英 README 以本地行为证据驱动的效率复盘系统定位，说明首次演示和面试展示流程。
- [架构说明](../focusledger/architecture.md)明确事件间隔推断 idle 的限制，以及未来结合 Windows `GetLastInputInfo` 的方向。本轮未接入 Windows Idle API。

本轮没有新增 AI、云同步或周报。系统采集、Tauri 2、Rust、React 和 SQLite 架构保留。

## 上一阶段验证记录（历史）

| 验证项 | 结果与证据范围 |
| --- | --- |
| Rust library | 858 passed、4 ignored、0 failed；沙箱内首次运行的 Windows 注册表/凭据访问失败，在允许专用测试条目访问后复跑通过 |
| 日报 Rust 专项 | 10 passed；覆盖合成完整一天、23/24/25 小时范围、极短范围、极端时间戳、真实规则、裁剪和既有迁移 |
| Rust 质量 | `cargo fmt --check`、Clippy `-D warnings` 通过；时间戳边界补充后再次通过专项和 Clippy |
| TypeScript 快速测试 | `pnpm test` 通过；视图保存修正后再次通过 `test:update` 和 `test:daily-review` |
| 风险域覆盖率 | lines 97.44%、functions 95.65%、branches 90.46%；逐文件阈值通过，只代表脚本指定风险域 |
| Mutation | 27/27 killed，只代表指定关键变异集合 |
| 真实浏览器专项 | 8 项通过，含首次进入 Demo、切换真实记录及重载保存、日期、空数据、错误恢复和布局 |
| 真实浏览器全量 | 165 项通过、退出码 0；涵盖首次 Demo、四语言、八页字体、设置、备份、分类、历史、统计、错误恢复和挂件 |
| Windows Tauri 专项 | 真实 WebView2 + 隔离 SQLite，通过首次 Demo、无演示写入、migration 17、真实日报、三类规则、日期切换和离线 IPC 拒绝验证 |
| 静态工程门禁 | 类型、lint、i18n、命名、架构、IPC、Rust 边界、热点、Quiet Pro 和测试治理通过；相关检查器自测通过 |
| Release / NSIS | Windows x64 release 与 NSIS 构建成功，退出码 0；最终产物大小及 SHA-256 见下表；未安装或启动新 release 产物 |

浏览器全量的首次运行暴露测试初始化覆盖场景导航值的问题；已修正为保留场景自己的导航设置，修正后全量通过。未通过放大超时或自动重试隐藏失败。

Tauri 专项使用隔离目录和生产形态静态前端，由调试版进程承载，验证真实 IPC 和落盘。它不冒充安装后的正式版人工验收。真实日报 fixture 为 133 分钟活动、30 分钟推断空闲、Activity Score 81；Demo 为 328 分钟活动、107 分钟推断空闲、Activity Score 75，包含五个应用及三类发现。停采后比较请求前后的 `sessions` 行数，确认 Demo 没有新增真实会话。

## 前端体积决策

测量口径：锁定 Node 24.21.0、pnpm 12.3.4，生产构建后使用 `check:bundle` 的 Node gzip 口径；Vite 打印的 gzip 数值口径不同，不混作预算证据。

上一阶段日报为 2.948 KiB。Demo 增加来源说明、按钮、本机偏好和请求参数；继续复用已有 Quiet Pro、浏览器存储网关和同一 Rust 引擎，无新增第三方依赖或图表库。初步构建日报约 3.15 KiB，原 3.22 KiB 预算的 3% 余量门槛不足，将该 owner 的预算窄调为 3.35 KiB；不预留未来功能体积。i18n、初始总量 310 KiB、全量 400 KiB 和其他 owner 预算保留。

首次默认进入日报会请求对应页面 chunk；预算检查器的 initial 数值只统计静态初始图，不等同于首屏全部请求量。最终构建的 `check:bundle` 通过：initial 199.63 KiB gzip、total 387.67 KiB gzip、DailyReview 3209 bytes（3.13 KiB）、localization 7675 bytes（7.50 KiB），后者仍在原 7.8 KiB 预算内。

## 历史边界与本轮结论

- 上一阶段 `check:full` 因缺少 `.git` 停止；本轮该环境阻塞仍在，已修复补充扫描发现的文档数量问题。
- 上一阶段依赖审计因缺少 `cargo-audit` 停止；本轮已安装工具并完成实际审计，结果及例外证据见上表。
- 仅验证 Windows x64，未取得 ARM64、全新机器安装/卸载、代码签名和外部发布证据。
- 版本沿用内部 `1.9.10`；此轮未创建 tag、推送、发布或安装正式程序。内部 Patina 标识和正式数据路径兼容保持，详见架构说明。
- 构建时旧 `FocusLedger.exe` 被正在运行的已验收程序占用。将旧文件原地保留为 `FocusLedger.accepted-mvp.exe` 后构建新产物，未结束旧进程或改动其数据库。旧产物校验见[上一阶段记录](focusledger-validation.md)。

结论：功能冻结保持，支持本机求职演示。依赖审计及本机回归已完成，正式发布仍被 Git 元数据、干净安装及发行信任/资产证据阻塞。

## 最终产物

以下路径相对于项目根目录，均为本轮最终构建，内部版本 `1.9.10`。文件大小为实际字节数，SHA-256 从生成后的文件计算。

| 产物路径 | 大小（bytes） | SHA-256 |
| --- | ---: | --- |
| `src-tauri/target/release/FocusLedger.exe` | 44,940,800 | `fde2ed59ca1c8b5205b689cc4c3eda5826a3937a3e0fdc50c107bedfd8d53f9a` |
| `src-tauri/target/release/bundle/nsis/FocusLedger_1.9.10_x64-setup.exe` | 10,645,085 | `c0d3a97c05a9c2b2bdce011657f32779d156854a32e3a146d68c8d7833ba5bde` |

这是本轮重新构建后的摘要，不能使用上一阶段摘要校验。未将哈希变化解释为源码行为变化，也未宣称构建具有字节可复现性。构建证据采集器在子进程成功后曾因终端 GBK 输出失败，子进程退出码 0 和完整文件日志已落盘；已修复仅证据目录内的输出编码，未改应用构建流程。

复现最终打包与校验（在项目根目录、Windows x64 构建环境执行）：

```powershell
pnpm run tauri build --bundles nsis
pnpm run check:bundle
Get-FileHash src-tauri/target/release/FocusLedger.exe -Algorithm SHA256
Get-FileHash src-tauri/target/release/bundle/nsis/FocusLedger_1.9.10_x64-setup.exe -Algorithm SHA256
```

`artifacts/daily-review.png` 为浏览器专项的 fixture 界面截图，已检查 Activity Score、时间分布及三类发现布局；它不是用户真实数据，也不是 Rust Demo 的完整数据截图。
