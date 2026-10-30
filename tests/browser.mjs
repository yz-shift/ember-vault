import { launchChromium } from "./launch.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
const dir = "output/browser";
fs.mkdirSync(dir, { recursive: true });
const browser = await launchChromium();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const state = async () =>
  JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const advance = async (ms) => page.evaluate((ms) => window.advanceTime(ms), ms);
const key = async (k, ms) => {
  await page.keyboard.down(k);
  await advance(ms);
  await page.keyboard.up(k);
};
const check = (name) => {
  checks.push(name);
  console.log("PASS", name);
};
const shot = async (name) => {
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  fs.writeFileSync(
    `${dir}/${name}.json`,
    JSON.stringify(await state(), null, 2),
  );
};
async function moveTo(x, y) {
  for (let i = 0; i < 24; i++) {
    const s = await state(),
      dx = x - s.player.x,
      dy = y - s.player.y;
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    const useX = Math.abs(dx) > Math.abs(dy);
    await key(
      useX ? (dx > 0 ? "d" : "a") : dy > 0 ? "s" : "w",
      Math.min(350, (Math.abs(useX ? dx : dy) / s.player.stats.speed) * 1000),
    );
  }
  throw new Error("moveTo stuck at " + JSON.stringify((await state()).player));
}
try {
  await page.goto("http://127.0.0.1:5180/?debug=1");
  await page.waitForFunction(() => window.__ember?.scene.ready);
  await advance(0);
  assert.equal((await state()).mode, "menu");
  await shot("01-start");
  check("start screen renders");
  await page.click("#start-btn");
  await page.evaluate(() => (window.__ember.scene.audioFX.enabled = false));
  await advance(30);
  assert.equal((await state()).mode, "playing");
  // Which relic the seed rolls is not what this check is about, and hard coding
  // it breaks whenever the relic pool changes. Read it off the floor instead.
  const opening = await state();
  const starter = opening.pickups.find((q) => q.kind === "item");
  assert.ok(starter, "spawn room should offer a starter relic");
  await key("w", 240);
  const collected = await state();
  assert.equal(
    Object.values(collected.player.items).reduce((a, b) => a + b, 0),
    1,
    "walking onto the relic must collect exactly one",
  );
  assert.notEqual(
    JSON.stringify(collected.player.stats),
    JSON.stringify(opening.player.stats),
    "the collected relic must actually change the player's stats",
  );
  assert.ok((await page.locator("#toast").innerText()).includes(starter.name));
  check(
    "start + WASD movement + physical starter pickup + name / effect toast",
  );
  await moveTo(480, 300);
  for (const k of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
    await key(k, 350);
    assert.ok(
      (await state()).bullets.some(
        (b) =>
          b.friendly &&
          (k === "ArrowUp"
            ? b.vy < 0
            : k === "ArrowDown"
              ? b.vy > 0
              : k === "ArrowLeft"
                ? b.vx < 0
                : b.vx > 0),
      ),
    );
  }
  check("all four shooting directions");
  // Held fire plus diagonal movement, driven by real key events. Pillars are
  // cleared so the distance travelled measures movement, not pathing.
  await page.evaluate(() => (window.__ember.model.room.obstacles = []));
  await moveTo(480, 380);
  const holdStart = await state();
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("w");
  await page.keyboard.down("d");
  await advance(1000);
  const holding = await state();
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("w");
  await page.keyboard.up("d");
  const fired = holding.progress.shots - holdStart.progress.shots;
  assert.ok(fired >= 5 && fired <= 8, `held fire produced ${fired} shots in 1s`);
  assert.ok(
    holding.player.x > holdStart.player.x + 90,
    `diagonal x moved ${holding.player.x - holdStart.player.x}`,
  );
  assert.ok(
    holding.player.y < holdStart.player.y - 90,
    `diagonal y moved ${holdStart.player.y - holding.player.y}`,
  );
  // Firing sideways while moving diagonally must not bend the shot off its aim.
  assert.ok(
    holding.bullets.some(
      (b) => b.friendly && b.vx > 0 && Math.abs(b.vy) < b.vx * 0.2,
    ),
  );
  await advance(600);
  assert.equal(
    (await state()).progress.shots,
    holding.progress.shots,
    "releasing the arrow key must stop fire",
  );
  check("held fire continues while diagonal movement runs uninterrupted");
  // Optional aim mode: WASD to move, mouse to aim, hold left button to fire.
  await page.click("#aim-btn");
  assert.equal((await state()).aimMode, "mouse");
  assert.ok((await page.locator("#aim-btn").innerText()).includes("鼠标瞄准"));
  await moveTo(480, 300);
  await page.evaluate(() => {
    window.__ember.model.bullets = [];
    window.__ember.model.player.fireCooldown = 0;
  });
  const canvasRect = await page.evaluate(() =>
    document.querySelector("canvas").getBoundingClientRect().toJSON(),
  );
  const toPage = (gx, gy) => ({
    x: canvasRect.x + (canvasRect.width * gx) / 960,
    y: canvasRect.y + (canvasRect.height * gy) / 600,
  });
  const aimAt = toPage(200, 120);
  await page.mouse.move(aimAt.x, aimAt.y);
  await page.mouse.down();
  await advance(420);
  const aimed = await state();
  await page.mouse.up();
  assert.ok(
    aimed.bullets.some((b) => b.friendly && b.vx < 0 && b.vy < 0),
    "held left button should fire toward the cursor",
  );
  await advance(500);
  assert.equal(
    (await state()).progress.shots,
    aimed.progress.shots,
    "releasing the left button must stop fire",
  );
  await page.click("#aim-btn");
  assert.equal((await state()).aimMode, "arrows");
  check("optional mouse aim fires toward the cursor and stops on release");
  await moveTo(350, 300);
  const before = (await state()).player.x;
  await page.keyboard.down("d");
  await key("Space", 160);
  await page.keyboard.up("d");
  assert.ok((await state()).player.x - before > 90);
  check("dash displacement and cooldown");
  await page.keyboard.press("Escape");
  assert.equal((await state()).mode, "paused");
  const paused = await state();
  await key("d", 500);
  assert.deepEqual(await state(), paused);
  await shot("02-pause");
  await page.click("#resume-btn");
  assert.equal((await state()).mode, "playing");
  check("Esc pauses simulation, button resumes");
  await moveTo(700, 300);
  await key("d", 1100);
  assert.equal((await state()).room.id, 1);
  assert.equal((await state()).room.type, "treasure");
  assert.equal((await state()).bullets.length, 0);
  check("physical door transition and bullet cleanup");
  for (const q of (await state()).pickups.filter((q) => q.kind === "item"))
    await moveTo(q.x, q.y);
  const relics = { ...(await state()).player.items };
  assert.ok(Object.values(relics).reduce((a, b) => a + b, 0) >= 3);
  await shot("03-treasure");
  check("two treasure relics collected and HUD inventory populated");
  await moveTo(480, 300);
  // Cross in short presses so the wave is not already over by the time we look.
  for (let i = 0; i < 40 && (await state()).room.id !== 2; i++)
    await key("d", 120);
  assert.equal((await state()).room.id, 2);
  // Sampled the moment the wave lands: every spawn is marked and inert first,
  // and none of them appears on top of the player.
  let arriving = await state();
  for (let i = 0; i < 30 && !arriving.enemies.length; i++) {
    await advance(60);
    arriving = await state();
  }
  assert.equal(arriving.room.locked, true);
  assert.ok(arriving.enemies.length >= 4, `wave of ${arriving.enemies.length}`);
  assert.ok(arriving.enemies.every((e) => e.spawnTime > 0));
  assert.ok(
    arriving.enemies.every(
      (e) => Math.hypot(e.x - arriving.player.x, e.y - arriving.player.y) > 120,
    ),
  );
  await advance(1400);
  assert.ok((await state()).enemies.every((e) => e.spawnTime === 0));
  await shot("04-battle");
  // This check is about the door, not about surviving a crowd, so walking back
  // across a live wave must not be able to end the run.
  await page.evaluate(() => (window.__ember.model.player.invincible = 9999));
  await moveTo(102, 300);
  await key("a", 450);
  assert.equal((await state()).room.id, 2);
  check("natural battle spawn closes door and blocks exit");
  // Controlled combat fixture: real keyboard shooting, collision, death and reward paths.
  await page.evaluate(async () => {
    const { makeEnemy } = await import("/src/game/enemies.ts");
    const g = window.__ember.model;
    g.player.x = 250;
    g.player.y = 300;
    g.player.invincible = 5;
    g.player.fireCooldown = 0;
    g.room.obstacles = [];
    g.room.waves = 1;
    g.wave = 1;
    g.waveDelay = 0;
    g.bullets = [];
    g.enemies = [makeEnemy(g.nextId++, "ring", { x: 430, y: 300 }, 0)];
    g.enemies[0].timer = 100;
    g.enemies[0].hp = 12;
  });
  await key("ArrowRight", 1700);
  assert.equal((await state()).enemies.length, 0);
  assert.equal((await state()).room.locked, false);
  assert.equal((await state()).room.rewarded, true);
  assert.equal((await state()).progress.cleared, 1);
  check("real bullets kill final enemy -> door opens -> one reward batch");
  await moveTo(480, 300);
  await advance(500);
  assert.ok((await state()).player.coins > 6);
  const rewardItem = (await state()).pickups.find((q) => q.kind === "item");
  if (rewardItem) await moveTo(rewardItem.x, rewardItem.y);
  await shot("05-cleared");
  const pickupsBefore = await page.evaluate(() =>
    window.__ember.model.room.pickups.map((p) => ({
      id: p.id,
      collected: p.collected,
    })),
  );
  await moveTo(300, 300);
  await key("a", 1600);
  assert.equal((await state()).room.id, 1);
  await key("d", 1100);
  assert.equal((await state()).room.id, 2);
  await advance(1500);
  assert.equal((await state()).enemies.length, 0);
  assert.equal((await state()).progress.cleared, 1);
  assert.deepEqual(
    await page.evaluate(() =>
      window.__ember.model.room.pickups.map((p) => ({
        id: p.id,
        collected: p.collected,
      })),
    ),
    pickupsBefore,
  );
  check(
    "cleared-room revisit preserves collected rewards and never respawns enemies",
  );
  await page.evaluate(() => {
    const g = window.__ember.model;
    g.enterRoom(g.rooms.find((r) => r.type === "shop").id);
    g.player.coins = 40;
    g.transition = 0;
  });
  await advance(30);
  const sale = (await state()).pickups.find((q) => q.kind === "item");
  await moveTo(sale.x, sale.y);
  const priorCoins = (await state()).player.coins;
  assert.ok((await page.locator("#pickup-hint").innerText()).includes("购买"));
  await key("e", 30);
  assert.equal((await state()).player.coins, priorCoins - sale.price);
  assert.ok(!(await state()).pickups.some((q) => q.id === sale.id));
  await key("e", 30);
  assert.equal((await state()).player.coins, priorCoins - sale.price);
  await shot("06-shop");
  check("E purchase debits exact price and removes stock once");
  await page.evaluate(() => {
    const g = window.__ember.model;
    for (const id of ["prism", "mirror", "needle", "frost", "fang", "cinder"])
      g.grantItem(id);
  });
  await advance(30);
  // Derive the expected count from the relic table rather than freezing a
  // number that changes every time a combo is added.
  const expectedCombos = await page.evaluate(async () => {
    const { COMBOS } = await import("/src/game/items.ts");
    const owned = window.__ember.model.player.items;
    return COMBOS.filter((c) => c.needs.every((id) => owned[id] > 0)).length;
  });
  assert.ok(expectedCombos >= 3, `only ${expectedCombos} combos from that set`);
  assert.equal((await state()).combos.length, expectedCombos);
  assert.equal(await page.locator("#combos>div").count(), expectedCombos);
  await shot("07-build");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  );
  check(
    "three combos reflected in simulation and HUD; expanded inventory stays within viewport",
  );
  await page.click("#codex-btn");
  assert.equal((await state()).mode, "paused");
  const relicCount = await page.evaluate(async () => {
    const { ITEMS } = await import("/src/game/items.ts");
    return ITEMS.length;
  });
  assert.ok(relicCount >= 16);
  assert.equal(await page.locator(".codex-items article").count(), relicCount);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  assert.equal((await state()).mode, "paused");
  await page.click("#resume-btn");
  check(`${relicCount}-item codex closes with Esc without resuming behind modal`);
  // Throughput under a deliberately dense build: spread + split + chain + blast
  // + bounce at high fire rate against a packed room.
  await page.evaluate(async () => {
    const { makeEnemy } = await import("/src/game/enemies.ts");
    const g = window.__ember.model;
    for (let i = 0; i < 3; i++)
      for (const id of ["prism", "shard", "conductor", "clock", "mirror", "cinder"])
        g.grantItem(id);
    g.player.x = 200;
    g.player.y = 300;
    g.player.invincible = 9999;
    g.enemies = [];
    for (let i = 0; i < 10; i++) {
      const e = makeEnemy(g.nextId++, "ring", {
        x: 520 + (i % 5) * 60,
        y: 220 + Math.floor(i / 5) * 90,
      }, 0);
      e.hp = e.maxHp = 1e6;
      e.timer = 1e6;
      g.enemies.push(e);
    }
    g.metrics.peakBullets = 0;
  });
  await page.keyboard.down("ArrowRight");
  const denseStart = Date.now();
  await advance(2000);
  const denseMs = Date.now() - denseStart;
  await page.keyboard.up("ArrowRight");
  const dense = await state();
  assert.ok(
    dense.metrics.peakBullets > 60,
    `dense build only reached ${dense.metrics.peakBullets} simultaneous tears`,
  );
  assert.ok(dense.bullets.filter((b) => b.friendly).length <= 260);
  assert.ok(dense.metrics.splits > 0 && dense.metrics.chainHits > 0);
  assert.ok(
    denseMs < 8000,
    `2s of dense combat took ${denseMs}ms to simulate and draw`,
  );
  check(
    `dense build holds the projectile budget (peak ${dense.metrics.peakBullets} tears; 2s simulated and drawn in ${denseMs}ms under SwiftShader)`,
  );
  await page.evaluate(() => {
    const g = window.__ember.model;
    g.enterRoom(g.rooms.find((r) => r.type === "boss").id);
    g.player.invincible = 999;
  });
  await advance(1100);
  assert.equal((await state()).enemies[0].kind, "boss");
  await advance(7000);
  assert.ok((await state()).enemies[0].pattern >= 3);
  check("Boss executes all three attack patterns");
  await page.evaluate(() => {
    const e = window.__ember.model.enemies[0];
    e.hp = e.maxHp * 0.49;
  });
  await advance(700);
  assert.equal((await state()).enemies[0].phase, 2);
  assert.ok((await page.locator("#boss-phase").innerText()).includes("灰烬"));
  await advance(600);
  await shot("08-boss-phase2");
  check("phase-two transition, extra bullets and visible Boss health bar");
  await page.evaluate(() => {
    const g = window.__ember.model,
      e = g.enemies[0];
    e.x = 480;
    e.y = 190;
    e.hp = 3;
    e.timer = 99;
    e.warning = 0;
    e.action = 0;
    g.player.x = 480;
    g.player.y = 340;
    g.player.fireCooldown = 0;
    g.bullets = [];
  });
  await key("ArrowUp", 600);
  assert.equal((await state()).mode, "won");
  await shot("09-victory");
  check("actual lethal player projectile triggers victory screen");
  await page.click("#restart-btn");
  assert.equal((await state()).mode, "playing");
  assert.equal((await state()).player.hp, 8);
  assert.equal((await state()).progress.cleared, 0);
  assert.deepEqual((await state()).player.items, {});
  check("victory restart resets the run");
  // Death is caused by an actual hostile projectile in a deterministic fixture.
  await page.evaluate(() => {
    const g = window.__ember.model;
    g.player.hp = 1;
    g.player.invincible = 0;
    g.enemyBullet({ x: g.player.x - 60, y: g.player.y }, 0, 190);
  });
  await advance(350);
  assert.equal((await state()).mode, "dead");
  await shot("10-death");
  await page.click("#restart-btn");
  const reset = await state();
  assert.equal(reset.mode, "playing");
  assert.equal(reset.seed, "LANTERN-01");
  assert.equal(reset.player.hp, 8);
  assert.equal(reset.player.coins, 6);
  assert.equal(reset.progress.kills, 0);
  assert.equal(reset.room.id, 0);
  assert.equal(reset.enemies.length, 0);
  assert.equal(reset.bullets.length, 0);
  check("hostile projectile death -> immediate restart with clean state");
  for (const size of [
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    const layout = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth,
      h: document.documentElement.scrollHeight,
      iw: innerWidth,
      ih: innerHeight,
      canvas: document.querySelector("canvas").getBoundingClientRect().toJSON(),
    }));
    assert.ok(layout.w <= layout.iw + 1, JSON.stringify(layout));
    assert.ok(layout.h <= layout.ih + 1, JSON.stringify(layout));
    assert.ok(layout.canvas.width > 400);
    await shot(`11-layout-${size.width}`);
  }
  check("1024×768, 1280×720 and 1920×1080 fit without overflow");
  assert.deepEqual(errors, []);
  check("no browser console or page errors");
  fs.writeFileSync(
    `${dir}/report.json`,
    JSON.stringify(
      {
        checks,
        errors,
        fixtures:
          "Targeted combat, shop, combos, Boss and death are isolated via dev-only fixtures; start, movement, items, doors, pause and restart use real browser inputs.",
      },
      null,
      2,
    ),
  );
} catch (e) {
  await shot("failure");
  fs.writeFileSync(
    `${dir}/failure.txt`,
    String(e.stack) + "\n" + JSON.stringify(errors),
  );
  throw e;
} finally {
  await browser.close();
}
