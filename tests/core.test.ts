import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/game.ts";
import { generateMap, DIRECTIONS } from "../src/game/map.ts";
import { ITEMS, COMBOS, getStats, activeCombos } from "../src/game/items.ts";
import { TUNING } from "../src/game/tuning.ts";
import { makeEnemy } from "../src/game/enemies.ts";
import { hitEnemy } from "../src/game/combat.ts";
import { emptyInput, BOUNDS } from "../src/game/types.ts";
import { overlaps } from "../src/game/physics.ts";
import type { Input } from "../src/game/types.ts";

function step(g: Game, seconds: number, input: Partial<Input> = {}) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++)
    g.tick(1 / 60, { ...emptyInput(), ...input });
}
const fresh = (seed = "LANTERN-01") => {
  const g = new Game();
  g.reset(seed);
  return g;
};
const battle = (g: Game) => {
  g.enterRoom(g.rooms.find((r) => r.type === "battle")!.id);
  step(g, 1);
  return g;
};

test("1000 seeds: 10–15 connected rooms, reciprocal doors, distant leaf boss and reachable shops / treasures", () => {
  for (let s = 0; s < 1000; s++) {
    const seed = "MAP-" + s,
      rooms = generateMap(seed);
    assert.ok(rooms.length >= 10 && rooms.length <= 15);
    const visited = new Set([0]),
      queue = [0];
    while (queue.length) {
      const r = rooms[queue.shift()!];
      for (const [dir, id] of Object.entries(r.doors)) {
        assert.equal(
          rooms[id!].doors[DIRECTIONS.find((d) => d.name === dir)!.opposite],
          r.id,
        );
        if (!visited.has(id!)) {
          visited.add(id!);
          queue.push(id!);
        }
      }
    }
    assert.equal(visited.size, rooms.length);
    assert.equal(rooms[0].type, "spawn");
    assert.equal(rooms[0].cleared, true);
    const boss = rooms.find((r) => r.type === "boss")!;
    assert.equal(boss.distance, Math.max(...rooms.map((r) => r.distance)));
    assert.ok(boss.distance >= 4);
    assert.equal(Object.keys(boss.doors).length, 1);
    assert.equal(rooms.filter((r) => r.type === "treasure").length, 2);
    assert.equal(rooms.filter((r) => r.type === "shop").length, 1);
    assert.ok(rooms.filter((r) => r.type === "battle").length >= 5);
    assert.deepEqual(generateMap(seed), rooms);
  }
});
test("safe spawn, normalized diagonal movement, solid wall and dash collision", () => {
  const a = fresh(),
    b = fresh();
  step(a, 0.5, { right: true });
  step(b, 0.5, { right: true, down: true });
  assert.ok(
    Math.abs(
      Math.hypot(b.player.x - 480, b.player.y - 300) - (a.player.x - 480),
    ) < 0.01,
  );
  step(a, 8, { up: true });
  assert.equal(a.enemies.length, 0);
  assert.equal(a.player.y, BOUNDS.top + a.player.r);
  a.room.obstacles = [{ x: 540, y: 250, w: 44, h: 100 }];
  a.player.x = 500;
  a.player.y = 300;
  step(a, 0.5, { right: true, dash: true });
  assert.ok(a.player.x <= 540 - a.player.r);
  assert.ok(!overlaps(a.player, a.player.r, a.room.obstacles[0]));
});
test("combat locks doors, successive waves clear once and revisits preserve rewards", () => {
  const g = battle(fresh());
  assert.ok(g.locked);
  assert.ok(g.enemies.length > 0);
  const dir = Object.keys(g.room.doors)[0];
  const id = g.roomId;
  g.player.x = dir === "west" ? 77 : dir === "east" ? 883 : 480;
  g.player.y = dir === "north" ? 77 : dir === "south" ? 523 : 300;
  step(g, 0.1, { left: true, right: true, up: true, down: true });
  assert.equal(g.roomId, id);
  // This test covers door locking and reward persistence, not survival. Waves
  // are real crowds now, so the stationary fixture player must not be killable.
  g.player.invincible = 9999;
  while (!g.room.cleared) {
    g.enemies.forEach((e) => hitEnemy(g, e, 999, g.player));
    step(g, 1.3);
  }
  assert.equal(g.clears, 1);
  assert.equal(g.locked, false);
  assert.ok(g.room.rewarded);
  const pickups = JSON.stringify(g.room.pickups);
  g.clearRoom();
  assert.equal(JSON.stringify(g.room.pickups), pickups);
  g.enterRoom(0);
  g.enterRoom(id, "east");
  step(g, 3);
  assert.equal(g.enemies.length, 0);
  assert.equal(JSON.stringify(g.room.pickups), pickups);
  assert.equal(g.clears, 1);
});
test("actual player shots damage and kill a target; piercing hits multiple enemies and mirrors bounce", () => {
  const g = fresh();
  g.player.x = 200;
  g.player.y = 300;
  g.enemies = [makeEnemy(100, "ring", { x: 400, y: 300 }, 0)];
  g.enemies[0].timer = 999;
  step(g, 0.6, { shootX: 1 });
  assert.ok(g.enemies[0].hp < g.enemies[0].maxHp);
  step(g, 3, { shootX: 1 });
  assert.equal(g.enemies.length, 0);
  assert.equal(g.kills, 1);
  g.grantItem("needle");
  g.enemies = [
    makeEnemy(102, "ring", { x: 360, y: 300 }, 0),
    makeEnemy(103, "ring", { x: 460, y: 300 }, 0),
  ];
  g.enemies.forEach((e) => (e.timer = 999));
  g.bullets = [];
  g.player.fireCooldown = 0;
  g.shoot(1, 0);
  step(g, 0.65);
  assert.ok(g.enemies.every((e) => e.hp < e.maxHp));
  g.enemies = [];
  g.grantItem("mirror");
  g.bullets = [];
  g.player.x = 850;
  g.shoot(1, 0);
  step(g, 0.12);
  assert.ok(g.bullets.some((b) => b.friendly && b.vx < 0));
});
test("every relic stacks; all build combinations activate and leech restores health", () => {
  assert.ok(ITEMS.length >= 16);
  const g = fresh();
  for (const item of ITEMS) {
    g.grantItem(item.id);
    g.grantItem(item.id);
    assert.equal(g.player.items[item.id], 2);
  }
  // Owning everything lights up every declared combo, whatever the count is.
  assert.equal(activeCombos(g.player.items).length, COMBOS.length);
  assert.ok(COMBOS.length >= 3);
  assert.ok(g.player.stats.fireRate > getStats({}).fireRate);
  assert.equal(g.player.stats.spread, 2);
  assert.equal(g.player.stats.bounce, 2);
  assert.equal(g.player.stats.pierce, 2);
  g.player.hp = 1;
  const e = makeEnemy(99, "boss", { x: 400, y: 300 }, 4);
  hitEnemy(g, e, 180, g.player);
  assert.ok(g.player.hp > 1);
});
test("shop is transactional, unaffordable and full-health purchases do not consume stock or coins", () => {
  const g = fresh();
  g.enterRoom(g.rooms.find((r) => r.type === "shop")!.id);
  const item = g.room.pickups.find((p) => p.kind === "item")!,
    heart = g.room.pickups.find((p) => p.kind === "heart")!;
  g.collect(item);
  assert.equal(g.player.coins, 6);
  assert.equal(item.collected, false);
  g.player.coins = 100;
  g.collect(heart);
  assert.equal(g.player.coins, 100);
  assert.equal(heart.collected, false);
  g.collect(item);
  assert.equal(g.player.coins, 100 - item.price);
  assert.equal(item.collected, true);
  const coins = g.player.coins;
  g.collect(item);
  assert.equal(g.player.coins, coins);
  const roomId = g.roomId;
  g.enterRoom(0);
  g.enterRoom(roomId);
  assert.ok(g.room.pickups.find((p) => p.id === item.id)!.collected);
});
test("all five enemy archetypes telegraph before their distinct attacks", () => {
  const melee = ["swarm", "chaser", "charger"];
  for (const kind of ["swarm", "chaser", "shooter", "charger", "ring"] as const) {
    const g = fresh();
    g.player.x = 480;
    g.player.y = 300;
    g.player.invincible = 999;
    // Swarm enemies commit from closer in than the others do.
    const startX = kind === "swarm" ? 405 : 370;
    const e = makeEnemy(90, kind, { x: startX, y: 300 }, 0);
    e.timer = 0;
    g.enemies = [e];
    step(g, 0.02);
    assert.ok(e.warning > 0, kind);
    assert.equal(g.bullets.length, 0);
    step(g, 1);
    if (melee.includes(kind)) assert.ok(e.x > startX + 20, kind);
    else assert.ok(g.bullets.length >= 3, kind);
  }
});
test("Boss uses ring, fan, charge and a second phase; lethal damage wins", () => {
  const g = fresh();
  g.enterRoom(g.rooms.find((r) => r.type === "boss")!.id);
  g.player.invincible = 999;
  step(g, 1);
  const boss = g.enemies[0];
  assert.equal(boss.phase, 1);
  const seen = new Set<number>();
  for (let i = 0; i < 1800; i++) {
    g.tick(1 / 60, emptyInput());
    seen.add(boss.pattern % 3);
  }
  assert.equal(seen.size, 3);
  assert.ok(boss.pattern >= 3);
  boss.hp = boss.maxHp * 0.49;
  step(g, 0.03);
  assert.equal(boss.phase, 2);
  hitEnemy(g, boss, 999, g.player);
  step(g, 0.03);
  assert.equal(g.mode, "won");
  assert.equal(g.bullets.length, 0);
});
test("contact invulnerability, dash immunity, pause and complete death reset", () => {
  const g = fresh();
  step(g, 1.2);
  assert.ok(g.hurtPlayer(1, { x: 0, y: 0 }));
  const hp = g.player.hp;
  assert.equal(g.hurtPlayer(1, { x: 0, y: 0 }), false);
  assert.equal(g.player.hp, hp);
  g.player.invincible = 0;
  g.player.dash = 0.2;
  assert.equal(g.hurtPlayer(1, { x: 0, y: 0 }), false);
  g.player.dash = 0;
  g.togglePause();
  const snapshot = JSON.stringify(g.snapshot());
  step(g, 2, { right: true, shootX: 1 });
  assert.equal(JSON.stringify(g.snapshot()), snapshot);
  g.togglePause();
  g.grantItem("prism");
  g.player.coins = 83;
  g.hurtPlayer(999, { x: 0, y: 0 });
  assert.equal(g.mode, "dead");
  g.reset(g.seed);
  assert.equal(g.mode, "playing");
  assert.equal(g.player.hp, 8);
  assert.equal(g.player.coins, 6);
  assert.deepEqual(g.player.items, {});
  assert.equal(g.elapsed, 0);
  assert.equal(g.kills, 0);
  assert.equal(g.clears, 0);
  assert.equal(g.bullets.length, 0);
  assert.equal(g.enemies.length, 0);
  assert.equal(g.rooms.filter((r) => r.visited).length, 1);
});
test("door traversal clears both kinds of projectiles and places player inside opposite entrance", () => {
  const g = fresh();
  g.player.x = 883;
  g.player.y = 300;
  g.transition = 0;
  g.shoot(-1, 0);
  g.enemyBullet({ x: 500, y: 400 }, 0, 100);
  step(g, 0.02, { right: true });
  assert.equal(g.roomId, 1);
  assert.equal(g.bullets.length, 0);
  assert.ok(g.player.x < 120 && g.player.x > BOUNDS.left + g.player.r);
  // Walk back rather than assuming a fixed travel time: the exact number of
  // ticks depends on movement tuning, the placement rule does not.
  let guard = 0;
  while (g.roomId !== 0 && guard++ < 240) step(g, 1 / 60, { left: true });
  assert.equal(g.roomId, 0);
  assert.ok(g.player.x > 800, `re-entered at x=${g.player.x}`);
});
test("seed reproduces map, starter, shop and treasure item rolls", () => {
  const a = fresh("REPRO-888"),
    b = fresh("REPRO-888");
  for (let id = 0; id < a.rooms.length; id++) {
    a.enterRoom(id);
    b.enterRoom(id);
    assert.deepEqual(a.room.pickups, b.room.pickups);
  }
  assert.deepEqual(a.rooms, b.rooms);
});
