// Deterministic playtest controller. It only supplies normal movement / shooting /
// dash / purchase inputs. No teleporting, damage changes, or invulnerability.
import { Game } from "../src/game/game.ts";
import { emptyInput } from "../src/game/types.ts";
import { distance, normal, overlaps, clamp } from "../src/game/physics.ts";
import type { Vec, Input } from "../src/game/types.ts";

const directionVectors = [
  { x: 0, y: 0 },
  ...Array.from({ length: 8 }, (_, i) => ({
    x: Math.round(Math.cos((i * Math.PI) / 4)),
    y: Math.round(Math.sin((i * Math.PI) / 4)),
  })),
];
function lineClear(g: Game, a: Vec, b: Vec, r = 15) {
  const steps = Math.ceil(distance(a, b) / 12);
  for (let i = 1; i <= steps; i++) {
    const p = {
      x: a.x + ((b.x - a.x) * i) / steps,
      y: a.y + ((b.y - a.y) * i) / steps,
    };
    if (g.room.obstacles.some((o) => overlaps(p, r, o))) return false;
  }
  return true;
}
function moveInput(v: Vec): Input {
  return {
    ...emptyInput(),
    left: v.x < 0,
    right: v.x > 0,
    up: v.y < 0,
    down: v.y > 0,
  };
}
function walk(g: Game, target: Vec) {
  const p = g.player;
  let goal = target;
  if (!lineClear(g, p, target)) {
    const nodes = [
      { x: p.x, y: p.y },
      target,
      ...g.room.obstacles.flatMap((o) => [
        { x: o.x - 25, y: o.y - 25 },
        { x: o.x + o.w + 25, y: o.y - 25 },
        { x: o.x - 25, y: o.y + o.h + 25 },
        { x: o.x + o.w + 25, y: o.y + o.h + 25 },
      ]),
    ];
    const cost = nodes.map(() => Infinity),
      prev = nodes.map(() => -1),
      done = new Set<number>();
    cost[0] = 0;
    for (let i = 0; i < nodes.length; i++) {
      let best = -1;
      for (let j = 0; j < nodes.length; j++)
        if (!done.has(j) && (best === -1 || cost[j] < cost[best])) best = j;
      if (best === 1 || best < 0) break;
      done.add(best);
      for (let j = 0; j < nodes.length; j++)
        if (!done.has(j) && lineClear(g, nodes[best], nodes[j])) {
          const d = cost[best] + distance(nodes[best], nodes[j]);
          if (d < cost[j]) {
            cost[j] = d;
            prev[j] = best;
          }
        }
    }
    let j = 1;
    while (prev[j] > 0) j = prev[j];
    if (prev[j] === 0) goal = nodes[j];
  }
  const dx = goal.x - p.x,
    dy = goal.y - p.y;
  return moveInput({
    x: Math.abs(dx) > 4 ? Math.sign(dx) : 0,
    y: Math.abs(dy) > 4 ? Math.sign(dy) : 0,
  });
}
function graphPath(g: Game, destination: number) {
  const queue = [g.roomId],
    prev = new Map([[g.roomId, -1]]);
  while (queue.length) {
    const id = queue.shift()!;
    if (id === destination) break;
    for (const n of Object.values(g.rooms[id].doors))
      if (!prev.has(n!)) {
        prev.set(n!, id);
        queue.push(n!);
      }
  }
  let id = destination;
  while (prev.get(id)! >= 0 && prev.get(id) !== g.roomId) id = prev.get(id)!;
  return id;
}
export function controller(g: Game): Input {
  const p = g.player;
  if (g.locked && g.enemies.length) {
    const target = g.enemies.slice().sort((a, b) => {
      const score = (e: typeof a) =>
        Math.min(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) * 0.8 +
        distance(p, e) * 0.11 +
        (lineClear(g, p, e, 4) ? 0 : 160);
      return score(a) - score(b);
    })[0];
    let best = emptyInput(),
      bestCost = Infinity;
    for (const raw of directionVectors) {
      const v = normal(raw.x, raw.y),
        vx = v.x * p.stats.speed,
        vy = v.y * p.stats.speed;
      const next = {
        x: clamp(p.x + vx * 0.3, 79, 881),
        y: clamp(p.y + vy * 0.3, 79, 521),
      };
      let cost = 0;
      if (!lineClear(g, p, next)) cost += 300;
      const wall = Math.min(
        next.x - 64,
        896 - next.x,
        next.y - 64,
        536 - next.y,
      );
      if (wall < 44) cost += (44 - wall) * 1.2;
      const dx = target.x - next.x,
        dy = target.y - next.y,
        d = distance(next, target);
      cost += Math.min(Math.abs(dx), Math.abs(dy)) * 0.38;
      if (!lineClear(g, next, target, 3)) cost += 100;
      if (d > 360) cost += (d - 360) * 0.15;
      if (d < 180) cost += (180 - d) * 0.35;
      for (const e of g.enemies) {
        const eNext = {
          x: e.x + (e.action > 0 ? e.vx * 0.3 : 0),
          y: e.y + (e.action > 0 ? e.vy * 0.3 : 0),
        };
        const near = distance(next, eNext);
        if (near < e.r + 95) cost += (e.r + 95 - near) * 3;
        if (
          e.warning > 0 &&
          (e.kind === "charger" ||
            e.kind === "chaser" ||
            (e.kind === "boss" && e.pattern % 3 === 2))
        ) {
          const along = (next.x - e.x) * e.aim.x + (next.y - e.y) * e.aim.y;
          const cross = Math.abs(
            (next.x - e.x) * e.aim.y - (next.y - e.y) * e.aim.x,
          );
          if (along > 0 && along < 390 && cross < 50) cost += (50 - cross) * 5;
        }
      }
      for (const b of g.bullets) {
        if (b.friendly || distance(p, b) > 245) continue;
        const rx = b.x - p.x,
          ry = b.y - p.y,
          rvx = b.vx - vx,
          rvy = b.vy - vy;
        const t = clamp(
          -(rx * rvx + ry * rvy) / (rvx * rvx + rvy * rvy || 1),
          0,
          0.55,
        );
        const near = Math.hypot(rx + rvx * t, ry + rvy * t);
        if (near < 40) cost += (40 - near) * (t < 0.2 ? 5 : 2.5);
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = moveInput(raw);
      }
    }
    const dx = target.x - p.x,
      dy = target.y - p.y;
    if (Math.abs(dx) < Math.abs(dy)) {
      best.shootY = Math.sign(dy);
    } else best.shootX = Math.sign(dx);
    best.dash =
      (p.dashCooldown <= 0 &&
        g.bullets.some((b) => !b.friendly && distance(b, p) < 53)) ||
      (p.dashCooldown <= 0 && g.enemies.some((e) => distance(e, p) < e.r + 45));
    return best;
  }
  if (g.locked) return emptyInput();
  const pickup = g.room.pickups
    .filter(
      (q) =>
        !q.collected &&
        q.price <= p.coins &&
        (q.kind !== "heart" || p.hp < p.stats.maxHp),
    )
    .sort((a, b) => distance(a, p) - distance(b, p))[0];
  if (pickup) {
    const i = walk(g, pickup);
    if (pickup.price && distance(p, pickup) < 60) i.interact = !g.lastInteract;
    return i;
  }
  const candidates = g.rooms
    .filter((r) => !r.visited && r.type !== "boss")
    .sort((a, b) => {
      const score = (r: typeof a) => {
        let steps = 0,
          id = r.id;
        while (id !== g.roomId && steps < 30) {
          id = graphPath({ ...g, roomId: id } as Game, g.roomId);
          steps++;
        }
        return steps + (r.type === "treasure" ? -1 : 0);
      };
      return score(a) - score(b);
    });
  const goal = candidates[0] || g.rooms.find((r) => r.type === "boss")!;
  const nextId = graphPath(g, goal.id);
  const dir = Object.entries(g.room.doors).find(([, id]) => id === nextId)?.[0];
  if (!dir) return emptyInput();
  const target = {
    x: dir === "west" ? 40 : dir === "east" ? 920 : 480,
    y: dir === "north" ? 40 : dir === "south" ? 560 : 300,
  };
  return walk(g, target);
}
