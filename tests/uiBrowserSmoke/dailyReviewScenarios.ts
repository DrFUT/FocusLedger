import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { evaluate, waitForAnimationFrames, waitForExpression } from "./browserHarness.ts";
import type { BrowserSmokeContext } from "./scenarioTypes.ts";

export async function runDailyReviewScenarios({ client, sessionId, runTest }: BrowserSmokeContext) {
  await runTest("first launch opens a labeled demo and remembers the real-data choice", async () => {
    await evaluate(client, sessionId, `localStorage.removeItem('patina:last-active-view'); localStorage.removeItem('focusledger:review-source'); location.reload()`);
    await waitForExpression(client, sessionId, `document.querySelector('[aria-label="每日复盘"]')?.textContent.includes('演示数据') && document.body.textContent.includes('Fixture Demo Editor')`);
    assert.equal(await evaluate(client, sessionId, `globalThis.__PATINA_INVOKED_COMMANDS.find(entry => entry.command === 'cmd_get_daily_review')?.payload.demo`), true);
    await evaluate(client, sessionId, `[...document.querySelectorAll('button')].find(node => node.textContent === '查看真实记录')?.click()`);
    await waitForExpression(client, sessionId, `document.querySelector('[aria-label="每日复盘"]')?.textContent.includes('Fixture Editor')`);
    await evaluate(client, sessionId, `location.reload()`);
    await waitForExpression(client, sessionId, `document.querySelector('[aria-label="每日复盘"]')?.textContent.includes('真实记录') && document.body.textContent.includes('Fixture Editor')`);
    assert.equal(await evaluate(client, sessionId, `globalThis.__PATINA_INVOKED_COMMANDS.find(entry => entry.command === 'cmd_get_daily_review')?.payload.demo`), false);
  });
  await runTest("daily review renders evidence and supports dates, empty data and retry", async () => {
    await evaluate(client, sessionId, `document.querySelector('[data-sidebar-nav-item="daily-review"]')?.click()`);
    await waitForExpression(client, sessionId, `document.querySelector('[aria-label="每日复盘"]')?.textContent.includes('Fixture Editor')`);
    const text = String(await evaluate(client, sessionId, `document.querySelector('[aria-label="每日复盘"]')?.textContent`));
    for (const expected of ["75", "Activity Score", "分类占比", "频繁切换应用", "长时间连续工作", "长时间空闲间隔"]) assert.ok(text.includes(expected), expected);
    for (const [width, height] of [[900, 636], [1440, 1100]]) {
      await client.command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
      await waitForAnimationFrames(client, sessionId, 3);
      const layout = await evaluate(client, sessionId, `(() => {
        const review = document.querySelector('[aria-label="每日复盘"]');
        const children = [...review.children].map(node => node.getBoundingClientRect());
        return {
          separated: children.every((rect, index) => index === 0 || rect.top >= children[index - 1].bottom),
          noHorizontalOverflow: review.scrollWidth <= review.clientWidth + 1,
          findingsReachable: review.scrollHeight > review.clientHeight || children.at(-1).bottom <= review.getBoundingClientRect().bottom,
        };
      })()`) as { separated: boolean; noHorizontalOverflow: boolean; findingsReachable: boolean };
      assert.deepEqual(layout, { separated: true, noHorizontalOverflow: true, findingsReachable: true }, JSON.stringify({ width, height, layout }));
    }
    if (process.env.FOCUSLEDGER_SCREENSHOT_PATH) {
      const screenshot = await client.command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId) as { data: string };
      writeFileSync(process.env.FOCUSLEDGER_SCREENSHOT_PATH, Buffer.from(screenshot.data, "base64"));
    }
    await client.command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 820, deviceScaleFactor: 1, mobile: false }, sessionId);
    await evaluate(client, sessionId, `document.querySelector('button[aria-label="前一天"]')?.click()`);
    await waitForExpression(client, sessionId, `globalThis.__PATINA_INVOKED_COMMANDS.filter(entry => entry.command === 'cmd_get_daily_review').length >= 2`);
    const ranges = await evaluate(client, sessionId, `globalThis.__PATINA_INVOKED_COMMANDS.filter(entry => entry.command === 'cmd_get_daily_review').map(entry => entry.payload.dayStartMs)`) as number[];
    assert.ok(ranges.at(-1)! < ranges[0]!);
    await evaluate(client, sessionId, `globalThis.__FOCUSLEDGER_REVIEW_MODE = 'empty'; document.querySelector('button[aria-label="刷新日报"]')?.click()`);
    await waitForExpression(client, sessionId, `document.body.textContent.includes('这一天没有采集到前台应用记录。')`);
    await evaluate(client, sessionId, `globalThis.__FOCUSLEDGER_REVIEW_MODE = 'error'; document.querySelector('button[aria-label="刷新日报"]')?.click()`);
    await waitForExpression(client, sessionId, `document.querySelector('[role="alert"]')?.textContent.includes('读取日报失败')`);
    await evaluate(client, sessionId, `globalThis.__FOCUSLEDGER_REVIEW_MODE = 'normal'; document.querySelector('button[aria-label="刷新日报"]')?.click()`);
    await waitForExpression(client, sessionId, `document.querySelector('[aria-label="每日复盘"]')?.textContent.includes('Fixture Editor')`);
  });
}
