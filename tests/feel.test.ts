/**
 * Feel-level invariants: the things that make movement and shooting read as
 * responsive rather than stiff. These are deliberately separate from
 * core.test.ts, which covers structure (maps, rooms, economy, boss).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/game.ts";
import { makeEnemy } from "../src/game/enemies.ts";
import { hitEnemy } from "../src/game/combat.ts";
import { distance } from "../src/game/physics.ts";
import { emptyInput } from "../src/game/types.ts";
import { TUNING as T } from "../src/game/tuning.ts";
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
const speedOf = (g: Game) => Math.hypot(g.player.velocity.x, g.player.velocity.y);

test("movement ramps in under 0.1s, stops in under 0.1s and leaves no drift", () => {
  const g = fresh();
  // There is a ramp — one frame of input must not already be full speed …
  step(g, 1 / 60, { right: true });
  assert.ok(speedOf(g) < T.player.speed, "instant full speed is not a ramp");
  // … but it has to be over quickly enough to feel immediate.
  step(g, 0.09, { right: true });
  assert.ok(
    speedOf(g) > T.player.speed - 0.01,
    `only reached ${speedOf(g)} of ${T.player.speed}`,
  );
  // Releasing stops the player outright: no glide, no residual velocity.
  step(g, 0.1);
  assert.equal(speedOf(g), 0);
  const restX = g.player.x;
  step(g, 0.5);
  assert.equal(g.player.x, restX, "player drifted after input released");
});

test("diagonal movement is normalised through the acceleration ramp, not just at full speed", () => {
  for (const seconds of [0.03, 0.05, 0.5]) {
    const a = fresh(),
      b = fresh();
    step(a, seconds, { right: true });
    step(b, seconds, { right: true, down: true });
    const straight = a.player.x - 480;
    const diagonal = Math.hypot(b.player.x - 480, b.player.y - 300);
    assert.ok(
      Math.abs(diagonal - straight) < 0.01,
      `at ${seconds}s: ${diagonal} vs ${straight}`,
    );
  }
});

test("holding a fire direction keeps firing at the configured rate", () => {
  const g = fresh();
  step(g, 1, { shootX: 1 });
  // One shot on press plus one per interval; allow a frame of slack either way.
  assert.ok(
    g.shots >= Math.floor(T.tear.rate) && g.shots <= Math.ceil(T.tear.rate) + 1,
    `fired ${g.shots} in one second at rate ${T.tear.rate}`,
  );
  // Releasing must not bank credit for a burst on the next press.
  const fired = g.shots;
  step(g, 1);
  assert.equal(g.shots, fired);
  step(g, 1 / 60, { shootX: 1 });
  assert.equal(g.shots, fired + 1);
});

test("shooting never interferes with movement, in any direction, at any time", () => {
  const plain = fresh(),
    shooting = fresh();
  step(plain, 0.6, { right: true });
  for (let i = 0; i < 36; i++)
    shooting.tick(1 / 60, {
      ...emptyInput(),
      right: true,
      // Sweep the aim around while moving: none of it may touch the movement.
      shootX: i % 4 === 0 ? 1 : i % 4 === 2 ? -1 : 0,
      shootY: i % 4 === 1 ? -1 : i % 4 === 3 ? 1 : 0,
    });
  assert.ok(Math.abs(plain.player.x - shooting.player.x) < 0.01);
  assert.equal(plain.player.y, shooting.player.y);
});

test("tears inherit some movement without bending away from the aim", () => {
  const g = fresh();
  step(g, 0.5, { down: true });
  assert.ok(speedOf(g) > T.player.speed - 0.01);
  g.player.fireCooldown = 0;
  g.bullets = [];
  g.shoot(1, 0);
  const b = g.bullets[0];
  const deviation = Math.abs(Math.atan2(b.vy, b.vx));
  assert.ok(b.vy > 0, "tear should carry the movement it inherited");
  assert.ok(deviation < 0.13, `aim bent by ${deviation} rad`);
});

test("the player slides along blocking geometry instead of sticking to it", () => {
  const g = fresh();
  g.player.x = 300;
  g.player.y = 300;
  g.room.obstacles = [{ x: 340, y: 100, w: 40, h: 400 }];
  step(g, 0.8, { right: true, down: true });
  assert.ok(
    g.player.x <= 340 - g.player.r + 0.01,
    `pushed into the pillar at ${g.player.x}`,
  );
  assert.ok(g.player.y > 360, `stuck against the pillar at y=${g.player.y}`);
  // The blocked axis must not hoard velocity and slingshot on release.
  assert.ok(Math.abs(g.player.velocity.x) < 1);
});

test("dying to one bullet in a dense volley does not break the tick", () => {
  const g = fresh();
  g.player.x = 480;
  g.player.y = 300;
  g.player.hp = 1;
  g.player.invincible = 0;
  // A wall of incoming fire: the shot that kills clears the bullet list while
  // the update loop is still walking it.
  for (let i = 0; i < 40; i++)
    g.enemyBullet({ x: 300, y: 240 + i * 3 }, 0.1 * (i % 5), 260);
  assert.doesNotThrow(() => step(g, 1.5));
  assert.equal(g.mode, "dead");
  assert.equal(g.bullets.length, 0);
});

test("nothing can wedge itself on a pillar corner", () => {
  const g = fresh();
  const pillar = { x: 280, y: 170, w: 44, h: 44 };
  g.room.obstacles = [pillar];
  // A chaser parked exactly on the corner, told to walk through it toward a
  // player on the far side. Axis-only resolution left it stuck here forever.
  const e = makeEnemy(80, "swarm", { x: 328.9, y: 222.7 }, 0);
  g.enemies = [e];
  g.player.x = 110;
  g.player.y = 207;
  g.player.invincible = 9999;
  const start = distance(e, g.player);
  step(g, 3);
  assert.ok(
    distance(e, g.player) < start - 60,
    `chaser only closed ${(start - distance(e, g.player)).toFixed(1)}px`,
  );
  // And it must never end up inside the geometry it walked around.
  assert.ok(
    Math.hypot(
      e.x - Math.max(pillar.x, Math.min(e.x, pillar.x + pillar.w)),
      e.y - Math.max(pillar.y, Math.min(e.y, pillar.y + pillar.h)),
    ) >= e.r - 0.01,
  );
});

test("waves telegraph, never spawn on the player, and are inert until they land", () => {
  const g = fresh();
  const room = g.rooms.find((r) => r.type === "battle")!;
  g.enterRoom(room.id);
  let guard = 0;
  while (!g.enemies.length && guard++ < 300) g.tick(1 / 60, emptyInput());
  assert.ok(g.enemies.length >= 4, `wave of ${g.enemies.length}`);
  for (const e of g.enemies) {
    assert.ok(e.spawnTime > 0, `${e.kind} spawned with no telegraph`);
    // Spot centres clear spawnDistance; per-enemy jitter can shave a little off.
    assert.ok(
      distance(e, g.player) > T.enemies.spawnDistance - 40,
      `${e.kind} spawned ${Math.round(distance(e, g.player))}px from the player`,
    );
  }
  // Nothing can be hit, and nothing can hit back, while the marker is showing.
  const target = g.enemies[0];
  hitEnemy(g, target, 999, g.player);
  assert.equal(target.hp, target.maxHp);
  g.player.invincible = 0;
  const hp = g.player.hp;
  target.x = g.player.x;
  target.y = g.player.y;
  g.tick(1 / 60, emptyInput());
  assert.equal(g.player.hp, hp);
});

test("swarm enemies die to a single base tear and crowds grow, HP does not", () => {
  const g = fresh();
  const e = makeEnemy(1, "swarm", { x: 400, y: 300 }, 0);
  hitEnemy(g, e, T.tear.damage, { x: 0, y: 300 });
  assert.ok(e.hp <= 0, "a starting tear must one-shot the weakest enemy");
  // Depth must not inflate health — that is what makes upgrades stop landing.
  for (const kind of ["swarm", "chaser", "shooter", "charger", "ring"] as const)
    assert.equal(
      makeEnemy(2, kind, { x: 0, y: 0 }, 9).hp,
      makeEnemy(3, kind, { x: 0, y: 0 }, 0).hp,
      kind,
    );
  // Deeper rooms send more of them instead.
  const wave = (dist: number) => {
    const q = fresh();
    const room = q.rooms.find((r) => r.type === "battle")!;
    room.distance = dist;
    q.enterRoom(room.id);
    q.spawnWave();
    return q.enemies.length;
  };
  assert.ok(wave(6) > wave(1), `${wave(6)} vs ${wave(1)}`);
});

test("relic growth measurably raises damage output, and combos stack together", () => {
  // Three wide, pinned dummies: broad enough that spread tears land, spaced so
  // that chain and blast have somewhere to travel. Pinning keeps the number a
  // measure of damage throughput rather than of knockback drift.
  const spots = [
    { x: 340, y: 250 },
    { x: 340, y: 300 },
    { x: 340, y: 350 },
  ];
  const output = (items: string[]) => {
    const g = fresh();
    g.player.invincible = 99999;
    for (const id of items) g.grantItem(id);
    g.player.x = 200;
    g.player.y = 300;
    g.enemies = spots.map((s, i) => {
      const e = makeEnemy(500 + i, "boss", { ...s }, 0);
      e.hp = e.maxHp = 9e6;
      e.timer = 9e6;
      return e;
    });
    for (let i = 0; i < 180; i++) {
      g.enemies.forEach((e, k) => {
        e.x = spots[k].x;
        e.y = spots[k].y;
      });
      g.tick(1 / 60, { ...emptyInput(), shootX: 1 });
    }
    return g.enemies.reduce((sum, e) => sum + (e.maxHp - e.hp), 0);
  };
  const base = output([]);
  assert.ok(base > 0, "base weapon deals no damage");
  const grown = output(["coal", "coal", "prism", "clock"]);
  assert.ok(
    grown > base * 2.5,
    `growth only reached ${(grown / base).toFixed(2)}x`,
  );
  // Procs are additive on top of raw stats, not a replacement for them.
  const procs = output(["coal", "coal", "prism", "clock", "conductor", "shard"]);
  assert.ok(procs > grown, `${procs} vs ${grown} without procs`);
});

test("dense builds stay inside the projectile and proc budgets", () => {
  const g = fresh();
  for (let i = 0; i < 4; i++)
    for (const id of ["prism", "shard", "mirror", "clock", "conductor", "cinder"])
      g.grantItem(id);
  g.enemies = [];
  for (let i = 0; i < 8; i++) {
    const e = makeEnemy(600 + i, "ring", { x: 560 + (i % 4) * 40, y: 260 + (i % 3) * 40 }, 0);
    e.hp = e.maxHp = 9e6;
    e.timer = 9e6;
    g.enemies.push(e);
  }
  g.player.x = 200;
  g.player.y = 300;
  g.player.invincible = 99999;
  for (let i = 0; i < 600; i++) {
    g.tick(1 / 60, { ...emptyInput(), shootX: 1 });
    assert.ok(
      g.bullets.filter((b) => b.friendly).length <=
        T.limits.friendlyBullets,
      `friendly bullets hit ${g.bullets.length}`,
    );
  }
  // Splits are generation capped, so they cannot feed themselves forever.
  assert.ok(g.bullets.every((b) => b.generation <= T.proc.fragmentGenerations));
  assert.ok(g.metrics.splits > 0 && g.metrics.chainHits > 0);
});
