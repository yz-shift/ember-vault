import { launchChromium } from "./launch.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
const dir = "output/full-browser";
fs.mkdirSync(dir, { recursive: true });
const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.goto("http://127.0.0.1:5180/?debug=1");
  await page.waitForFunction(() => window.__ember?.scene.ready);
  await page.evaluate(() => window.advanceTime(0));
  await page.click("#start-btn");
  await page.evaluate(async () => {
    window.__playtestController = (
      await import("/tests/controller.ts")
    ).controller;
    window.__ember.scene.audioFX.enabled = false;
    window.__visits = [];
  });
  let s;
  let bossCaptured = false;
  for (let chunk = 0; chunk < 90; chunk++) {
    s = await page.evaluate(() => {
      const { model: g, scene } = window.__ember;
      for (let frame = 0; frame < 600 && g.mode === "playing"; frame++) {
        if (frame % 5 === 0)
          window.__playtestInput = window.__playtestController(g);
        const room = g.roomId;
        g.tick(1 / 60, window.__playtestInput);
        if (room !== g.roomId)
          window.__visits.push({
            room: g.roomId,
            time: Math.round(g.elapsed),
            hp: g.player.hp,
          });
        if (frame % 60 === 0) scene.draw(1 / 60);
      }
      scene.draw(1 / 60);
      scene.onFrame();
      return g.snapshot();
    });
    if (s.room.type === "boss" && !bossCaptured) {
      await page.screenshot({
        path: `${dir}/boss.png`,
        fullPage: true,
      });
      bossCaptured = true;
    }
    if (chunk % 10 === 0)
      console.log(
        "Playtest",
        Math.round(s.elapsed) + "s",
        "room",
        s.room.id,
        "hp",
        s.player.hp,
        "kills",
        s.progress.kills,
      );
    if (s.mode !== "playing") break;
  }
  assert.equal(s.mode, "won");
  assert.equal(s.progress.visited, s.progress.total);
  // Clearing is several times faster than it was, so a controller run now lands
  // well under the old 300-600s band. What still means something is "neither
  // instant nor a slog" — the pace itself is asserted separately below.
  assert.ok(
    s.elapsed >= 120 && s.elapsed <= 600,
    `controller run took ${Math.round(s.elapsed)}s`,
  );
  assert.equal(s.progress.cleared, 8);
  // The point of the rework: crowds come apart continuously, not one at a time.
  const killsPerSecond = s.progress.kills / s.elapsed;
  assert.ok(
    killsPerSecond > 0.6,
    `only ${killsPerSecond.toFixed(2)} kills/s (${s.progress.kills} kills in ${Math.round(s.elapsed)}s)`,
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${dir}/victory.png`, fullPage: true });
  // Verify fully populated inventory/combos cannot enlarge the canvas row.
  const metrics = [];
  for (const size of [
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(100);
    metrics.push(
      await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      })),
    );
    const last = metrics.at(-1);
    assert.ok(
      last.scrollWidth <= last.width + 1 &&
        last.scrollHeight <= last.height + 1,
      JSON.stringify(last),
    );
  }
  const report = {
    result: "won",
    seed: s.seed,
    seconds: s.elapsed,
    progress: s.progress,
    hp: s.player.hp,
    items: s.player.items,
    visits: await page.evaluate(() => window.__visits),
    viewportChecks: metrics,
    errors,
    method:
      "Fresh LANTERN-01 run. Controller supplies ordinary Input values to the same simulation used by keyboard controls. No gameplay state changes, teleport, damage adjustment, enemy deletion or invulnerability fixture.",
  };
  fs.writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
