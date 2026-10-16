# FocusLedger MVP 验证与体积决策

日期：2026-10-14。工作区是没有 Git 元数据的源码副本，无法绑定提交或取得可复现的上游发布体积基线。本记录不冒充正式发布证据。

## Bundle owner 决策

测量环境：Windows x64、Node 24.21.0、pnpm 12.3.4、锁定依赖，`pnpm run build` 后由预算检查器的 Node gzip 口径测量。

- 日报是明确新增的长期能力，`DailyReview` 仅在导航时懒加载，没有新第三方依赖。当前 3019 bytes（2.948 KiB）gzip；此前没有此 route 的预算，误归入 support aggregate。新增独立 3.22 KiB owner 预算，必要体积以上约 9.2% 缓冲；support 预算不变。
- localization runtime 当前 7651 bytes（7.472 KiB）gzip，旧预算 7.65 KiB 的 3% 余量线为 7.421 KiB。新增日报消息 key/参数元数据归属于既有 i18n owner；四种语言文本仍分 chunk。新预算 7.8 KiB，预算增长 0.15 KiB（1.96%），实际值以上 4.39% 缓冲。上游实际发布基线缺失，因此不声称此预算差值等于源码增长。
- 已排查按需导入、拆包、去重及依赖替换：日报使用已有 React、图标和 Quiet Pro 组件，没有重复图表库；文本走既有 locale loaders。为几十字节缺口另建 i18n 加载机制会增加运行时复杂度及重复编译契约，因此保留现有 i18n owner。
- localization 元数据随启动加载，日报 React chunk 在首次打开时加载；这个窄调整不改变加载阶段。保持初始 JS+CSS 310 KiB、总 JS+CSS 400 KiB、support 和其他 route 预算不变，无未来功能预留。

## 已取得证据

- Rust library：857 passed、4 ignored、0 failed；Clippy `-D warnings` 通过。
- TypeScript 快速测试、类型、lint、i18n、架构、IPC、Rust 边界和测试治理通过。
- 风险域 coverage：97.44% lines，逐文件门槛通过；mutation：27/27 killed。该 coverage 仅代表选定风险域，不代表全仓覆盖率。
- 最终生产前端构建及 bundle 门槛通过：initial 199.46 KiB、total 386.97 KiB gzip；日报 2.95 KiB、support 5.35 KiB。
- 日报 browser smoke：7 项通过，包含启动契约和日报日期、空数据、读取失败及重试。`artifacts/daily-review.png` 为明确的 fixture 数据截图。
- 最终完整 `pnpm run test:ui-browser-smoke`：164 项通过，进程退出码 0；覆盖八页字体、四语言与主题、离线更新入口、持久化远程配置隐藏、本地备份、分类、历史、统计、错误恢复及挂件。远程 WebDAV 操作由独立的离线拒绝测试替代。
- Windows Tauri runtime focused smoke：使用隔离 SQLite 数据库，验证 migration 17、133 分钟活动 / 30 分钟推断空闲 / 81 分、三类行为发现与 React 日期切换；验证 WebDAV 和 updater IPC 拒绝远程操作。测试进程和临时数据自动清理。
- 日报补充 900×636 / 1440×1100 浏览器布局断言，覆盖面板间隔、横向溢出和底部发现可达性；截图已人工检查，说明与发现没有重叠。
- Windows x64 release `pnpm run tauri build --no-bundle` 成功，产物 `src-tauri/target/release/FocusLedger.exe`。Release 使用内嵌前端，debug 构建仍使用开发服务器。正式 profile 程序未自动启动，避免写入用户的既有正式数据库；桌面运行证据来自上述隔离 runtime 测试。
- Windows x64 NSIS 打包成功：`src-tauri/target/release/bundle/nsis/FocusLedger_1.9.10_x64-setup.exe`，10,629,658 bytes。未自动安装。打包工具的 updater bundle-type 警告不影响已禁用 updater 的本地 MVP。
- 全量 `check:full` 受 `check:docs` 的 `git ls-files` 依赖阻断，不能记为全通过。`check:dependencies` 首次受沙箱网络限制；允许下载后，Windows 目标可达性阶段通过，但当前环境缺少 `cargo-audit`，依赖审计仍不计为通过。

分析口径和 MVP 限制由 [架构说明](../focusledger/architecture.md) 维护。

## 交付产物 SHA-256

- `FocusLedger.exe`（44,953,600 bytes）：`5ADA46EC800ED548149815ECC7B36D6DBB61FF592B3B46E1AB0852EC1A35D6C7`
- `FocusLedger_1.9.10_x64-setup.exe`：`3D04B58ED3A6A08801E74E33F102C9A95F5701390F3634C7E947EE75C67E6241`
