import type { Enemy, EnemyKind, Vec } from "./types.ts";
import { distance, move, normal } from "./physics.ts";
import type { Game } from "./game.ts";
import { TUNING as T } from "./tuning.ts";

export function makeEnemy(
  id: number,
  kind: EnemyKind,
  p: Vec,
  depth: number,
): Enemy {
  const hp = T.enemies.hp[kind];
  return {
    id,
    kind,
    ...p,
    r: kind === "boss" ? 30 : kind==='swarm'?10:14,
    hp,
    maxHp: hp,
    speed: T.enemies.speed[kind],
    timer: 0.9 + (id % 5) * 0.21,
    warning: 0,
    action: 0,
    aim: { x: 0, y: 1 },
    vx: 0,
    vy: 0,
    flash: 0,
    slow: 0,
    phase: 1,
    pattern: 0,
    spawnTime:0,stagger:0,detour:0,elite:kind!=='swarm'&&kind!=='chaser'&&kind!=='boss'&&depth>=4,
  };
}

/**
 * Walk an enemy and notice when geometry ate the movement.
 *
 * Enemies steer straight at the player and have no pathfinding, so one that
 * meets a pillar face on can press into it forever — and if the player is
 * behind that pillar too, the room can never be cleared. Committing to one
 * side for a moment is enough to round any obstacle in these rooms, and the
 * side is derived from the id so the behaviour stays reproducible.
 */
function walk(g: Game, e: Enemy, dir: Vec, speed: number, dt: number) {
  const angle = e.detour > 0 ? (e.id % 2 ? 1.25 : -1.25) : 0;
  const step = angle
    ? {
        x: dir.x * Math.cos(angle) - dir.y * Math.sin(angle),
        y: dir.x * Math.sin(angle) + dir.y * Math.cos(angle),
      }
    : dir;
  const fromX = e.x,
    fromY = e.y;
  move(e, step.x * speed * dt, step.y * speed * dt, g.room.obstacles);
  const wanted = Math.abs(speed) * dt;
  if (wanted > 0.01 && Math.hypot(e.x - fromX, e.y - fromY) < wanted * 0.4)
    e.detour = 0.6;
}

function fan(g: Game, e: Enemy, count: number, spread: number, speed: number) {
  const angle = Math.atan2(e.aim.y, e.aim.x);
  for (let i = 0; i < count; i++)
    g.enemyBullet(e, angle + (i - (count - 1) / 2) * spread, speed);
}
function ring(g: Game, e: Enemy, count: number, offset: number) {
  // Two missing adjacent spokes always form a readable escape gap.
  for (let i = 2; i < count; i++)
    g.enemyBullet(
      e,
      offset + (i / count) * Math.PI * 2,
      e.kind === "boss" ? 145 + e.phase * 15 : 145,
    );
}

export function updateEnemies(g: Game, dt: number) {
  const p = g.player;
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    e.flash = Math.max(0, e.flash - dt);
    if(e.spawnTime>0){e.spawnTime=Math.max(0,e.spawnTime-dt);continue;}
    if(e.stagger>0){e.stagger=Math.max(0,e.stagger-dt);continue;}
    e.slow = Math.max(0, e.slow - dt);
    e.detour = Math.max(0, e.detour - dt);
    const slow = e.slow > 0 ? 0.7 : 1;
    if (e.kind === "boss" && e.phase === 1 && e.hp <= e.maxHp * 0.5) {
      e.phase = 2;
      e.timer = 0.75;
      e.warning = 0;
      e.action = 0;
      g.bullets = g.bullets.filter((b) => b.friendly);
      g.toast(
        "空冠守望者 · 灰烬觉醒",
        "第二阶段：更快的攻击，留意地面预警",
        3.2,
      );
      g.emit("phase", e.x, e.y);
    }
    if (e.action > 0) {
      e.action -= dt;
      move(e, e.vx * dt * slow, e.vy * dt * slow, g.room.obstacles);
      if (e.action <= 0) {
        e.timer = e.kind === "boss" ? 1.0 : 1.25;
        e.vx = 0;
        e.vy = 0;
      }
    } else if (e.warning > 0) {
      e.warning -= dt;
      if (e.warning <= 0) {
        if (e.kind === "chaser"||e.kind==='swarm') {
          e.action = e.kind==='swarm'?.19:.24;
          e.vx = e.aim.x * (e.kind==='swarm'?195:250);
          e.vy = e.aim.y * (e.kind==='swarm'?195:250);
        }
        if (e.kind === "shooter") {
          fan(g, e, e.elite?5:3, 0.22, 188);
          e.timer = e.elite?1.65:2.1;
        }
        if (e.kind === "charger") {
          e.action = 0.65;
          e.vx = e.aim.x * 330;
          e.vy = e.aim.y * 330;
          g.emit("dash", e.x, e.y);
        }
        if (e.kind === "ring") {
          ring(g, e, e.elite?14:10, e.pattern * 0.43);
          e.pattern++;
          e.timer = 2.45;
        }
        if (e.kind === "boss") {
          const attack = e.pattern % 3;
          if (attack === 0) {
            ring(g, e, e.phase === 2 ? 24 : 18, e.pattern * 0.39);
            if (e.phase === 2) ring(g, e, 16, e.pattern * 0.39 + 0.15);
            e.timer = e.phase === 2 ? 1.15 : 1.55;
          }
          if (attack === 1) {
            fan(g, e, e.phase === 2 ? 9 : 5, 0.145, 218);
            e.timer = e.phase === 2 ? 0.85 : 1.25;
          }
          if (attack === 2) {
            e.action = e.phase === 2 ? 0.85 : 0.7;
            e.vx = e.aim.x * 360;
            e.vy = e.aim.y * 360;
            g.emit("dash", e.x, e.y);
          }
          e.pattern++;
          g.emit("enemyShoot", e.x, e.y);
        }
      }
    } else {
      e.timer -= dt;
      const aim = normal(p.x - e.x, p.y - e.y);
      if (e.kind === "chaser"||e.kind==='swarm') {
        // A small fixed fan keeps a pod from collapsing onto one line, which is
        // what leaves gaps to walk through instead of a solid wall of bodies.
        const angle=(e.id%3-1)*.22;
        const chase={x:aim.x*Math.cos(angle)-aim.y*Math.sin(angle),y:aim.x*Math.sin(angle)+aim.y*Math.cos(angle)};
        walk(g, e, chase, e.speed * slow, dt);
        if (distance(e, p) < (e.kind==='swarm'?105:155) && e.timer <= 0) {
          e.warning = e.kind==='swarm'?.38:.48;
          e.aim = aim;
        }
      } else {
        if (e.kind === "shooter") {
          const d = distance(e, p),
            sign = d < 160 ? -1 : d > 300 ? 1 : 0;
          // Kite into the comfort band, then circle. A shooter that holds a
          // perfectly fixed spot can end up somewhere the player is simply
          // unable to line a shot up on, which stalls the room outright.
          if (sign) walk(g, e, aim, e.speed * slow * sign, dt);
          else
            walk(
              g,
              e,
              { x: -aim.y, y: aim.x },
              e.speed * slow * (e.id % 2 ? 0.85 : -0.85),
              dt,
            );
        }
        // Ring and charger creep in between attacks, so no enemy is a fixture
        // and the player is always the one choosing the range.
        if (e.kind === "ring" || e.kind === "charger")
          walk(g, e, aim, e.speed * slow, dt);
        if (e.kind === "boss") walk(g, e, aim, 25 * slow, dt);
        if (e.timer <= 0) {
          e.aim = aim;
          e.warning =
            e.kind === "boss"
              ? e.phase === 2
                ? 0.63
                : 0.85
              : e.kind === "charger"
                ? 0.85
                : 0.7;
        }
      }
    }
    // Separate crowds without allowing an enemy through solid geometry.
    for (const other of g.enemies) {
      if (other.id >= e.id || other.hp <= 0) continue;
      const d = distance(e, other);
      if (d < e.r + other.r+T.enemies.personalSpace) {
        const v = d>.01?normal(e.x - other.x, e.y - other.y):normal(e.id%2?1:-1,1);
        move(e, v.x * T.enemies.separation * dt, v.y * T.enemies.separation * dt, g.room.obstacles);
        move(other,-v.x*T.enemies.separation*dt,-v.y*T.enemies.separation*dt,g.room.obstacles);
      }
    }
    // Melee damage exists during the telegraphed attack, never passive crowd overlap.
    if (e.action>0&&distance(p, e) < p.hurtRadius + e.r) g.hurtPlayer(e.kind === "boss" ? 2 : 1, e);
  }
}
