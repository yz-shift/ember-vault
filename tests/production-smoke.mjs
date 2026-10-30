import { launchChromium } from "./launch.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * Smoke test against the built bundle in dist/, served on 4180.
 *
 * Everything here runs on the real-time Phaser loop — no window.advanceTime,
 * no dev fixtures — because the point is to prove the shipped build actually
 * runs. Headless software rendering can sit well under 60fps, so progress is
 * waited for rather than inferred from wall-clock time.
 */
const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

const state = async () =>
  JSON.parse(await page.evaluate(() => window.render_game_to_text()));

/** Wait until the live loop has advanced the clock, or give up and report. */
async function waitForProgress(from, minimum, budgetMs = 10000) {
  const deadline = Date.now() + budgetMs;
  let latest = await state();
  while (Date.now() < deadline && latest.elapsed < from + minimum) {
    await page.waitForTimeout(120);
    latest = await state();
  }
  return latest;
}

try {
  await page.goto("http://127.0.0.1:4180/?debug=1");
  await page.waitForSelector("#start-btn");
  // Dev-only fixtures must not exist in a production build, even when asked for.
  assert.equal(await page.evaluate(() => typeof window.__ember), "undefined");

  await page.click("#start-btn");
  const initial = await state();
  await page.keyboard.down("d");
  await page.keyboard.down("ArrowUp");
  const running = await waitForProgress(initial.elapsed, 0.45);
  await page.keyboard.up("d");
  await page.keyboard.up("ArrowUp");
  assert.equal(running.mode, "playing");
  assert.ok(
    running.elapsed > initial.elapsed + 0.3,
    `real-time clock only advanced ${(running.elapsed - initial.elapsed).toFixed(2)}s`,
  );
  assert.ok(
    running.player.x > initial.player.x + 50,
    `real-time movement covered only ${(running.player.x - initial.player.x).toFixed(1)}px`,
  );
  assert.ok(running.progress.shots > 0, "a held arrow key fired nothing");

  await page.keyboard.press("Escape");
  await page.waitForSelector("#resume-btn");
  const paused = await state();
  await page.waitForTimeout(400);
  assert.equal(
    (await state()).elapsed,
    paused.elapsed,
    "the paused simulation kept ticking",
  );

  await page.click("#resume-btn");
  const resumed = await waitForProgress(paused.elapsed, 0.2);
  assert.equal(resumed.mode, "playing");
  assert.ok(
    resumed.elapsed > paused.elapsed,
    "resume did not restart the loop",
  );
  assert.deepEqual(errors, []);

  fs.mkdirSync("output/production", { recursive: true });
  await page.screenshot({ path: "output/production/realtime.png" });
  fs.writeFileSync(
    "output/production/report.json",
    JSON.stringify(
      {
        build: "dist",
        debugEntryExposed: false,
        realtimeMovement: true,
        realtimeShooting: true,
        pauseAndResume: true,
        note: "Progress is waited for rather than assumed: headless software rendering runs well below 60fps, so a fixed wall-clock budget would not prove anything about the build.",
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS production bundle: real-time movement/shooting, pause/resume, no debug fixture exposure, no browser errors",
  );
} catch (error) {
  console.log(JSON.stringify(errors));
  fs.mkdirSync("output/production", { recursive: true });
  await page.screenshot({ path: "output/production/failure.png" });
  throw error;
} finally {
  await browser.close();
}
