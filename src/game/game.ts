import { Random } from "./random.ts";
import { DIRECTIONS, generateMap } from "./map.ts";
import {
  ITEMS,
  ITEM_BY_ID,
  OFFENSIVE_ITEMS,
  getStats,
  activeCombos,
} from "./items.ts";
import { makeEnemy, updateEnemies } from "./enemies.ts";
import { updateBullets } from "./combat.ts";
import { clamp, distance, move, normal, overlaps } from "./physics.ts";
import { BOUNDS, ROOM_NAMES } from "./types.ts";
import { TUNING } from "./tuning.ts";
import type {
  Bullet,
  Direction,
  Enemy,
  EnemyKind,
  Input,
  Particle,
  Pickup,
  Player,
  Room,
  Vec,
  AimMode,
  CombatEffect,
} from "./types.ts";

export class Game {
  mode: "menu" | "playing" | "paused" | "dead" | "won" = "menu";
  seed = "LANTERN-01";
  rng = new Random(this.seed);
  rooms: Room[] = [];
  roomId = 0;
  player!: Player;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  effects: CombatEffect[] = [];
  aimMode: AimMode = "arrows";
  spawnedThisTick = 0;
  metrics = { peakBullets: 0, splits: 0, chainHits: 0, explosions: 0, droppedBullets: 0 };
  events: { kind: string; x: number; y: number; value: number }[] = [];
  notice = { title: "", description: "", time: 0 };
  elapsed = 0;
  kills = 0;
  clears = 0;
  transition = 0;
  waveDelay = 0;
  wave = 0;
  nextId = 1;
  dirty = true;
  lastDash = false;
  lastInteract = false;
  lastRoomId = -1;
  shots = 0;
  constructor() {
    this.reset("LANTERN-01", false);
  }
  get room() {
    return this.rooms[this.roomId];
  }
  get locked() {
    return (
      !this.room.cleared &&
      (this.room.type === "battle" || this.room.type === "boss")
    );
  }
  reset(seed: string, start = true) {
    this.seed = seed.trim().slice(0, 40) || "LANTERN-01";
    this.rng = new Random(this.seed + ":combat");
    this.rooms = generateMap(this.seed);
    this.roomId = 0;
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.effects = [];
    this.spawnedThisTick = 0;
    this.metrics = { peakBullets: 0, splits: 0, chainHits: 0, explosions: 0, droppedBullets: 0 };
    this.events = [];
    this.elapsed = 0;
    this.kills = 0;
    this.clears = 0;
    this.nextId = 1;
    this.shots = 0;
    this.transition = 0;
    this.waveDelay = 0;
    this.wave = 0;
    this.lastDash = false;
    this.lastInteract = false;
    this.lastRoomId = -1;
    const stats = getStats({});
    this.player = {
      x: 480,
      y: 330,
      r: TUNING.player.radius,
      hurtRadius: TUNING.player.hurtRadius,
      velocity: { x:0,y:0 },
      moveFacing: { x:0,y:1 },
      firePulse: 0,
      hp: stats.maxHp,
      coins: 6,
      invincible: 0,
      dash: 0,
      dashCooldown: 0,
      fireCooldown: 0,
      facing: { x: 0, y: -1 },
      dashVector: { x: 0, y: -1 },
      items: {},
      stats,
      shield: 0,
      leechCharge: 0,
    };
    this.mode = start ? "playing" : "menu";
    this.notice = { title: "", description: "", time: 0 };
    this.enterRoom(0);
    if (start)
      this.toast(
        "灯火尚未熄灭",
        "收集 3 枚守印，前往地图深处挑战空冠守望者",
        5,
      );
  }
  togglePause() {
    if (this.mode === "playing") this.mode = "paused";
    else if (this.mode === "paused") this.mode = "playing";
    this.dirty = true;
  }
  toast(title: string, description = "", time = 2.8) {
    this.notice = { title, description, time };
    this.dirty = true;
  }
  emit(kind: string, x: number, y: number, value = 0) {
    this.events.push({ kind, x, y, value });
    if (this.events.length > 240) this.events.shift();
  }
  pickup(
    kind: Pickup["kind"],
    x: number,
    y: number,
    value = 1,
    item?: string,
    price = 0,
  ): Pickup {
    return {
      id: this.nextId++,
      kind,
      x,
      y,
      value,
      item,
      price,
      collected: false,
    };
  }
  randomItem(pool?: string[]) {
    return pool && pool.length ? this.rng.pick(pool) : this.rng.pick(ITEMS).id;
  }
  enterRoom(id: number, from?: Direction) {
    this.lastRoomId = this.roomId;
    this.roomId = id;
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.effects = [];
    this.events = [];
    this.waveDelay = 0;
    this.wave = 0;
    this.transition = TUNING.room.transition;
    const p = this.player;
    p.x = 480;
    p.y = 300;
    if (from === "east") p.x = BOUNDS.left + 38;
    if (from === "west") p.x = BOUNDS.right - 38;
    if (from === "north") p.y = BOUNDS.bottom - 38;
    if (from === "south") p.y = BOUNDS.top + 38;
    p.dash = 0;
    p.velocity = { x:0,y:0 };
    p.invincible = 1.1;
    p.shield = p.stats.shield;
    const r = this.room;
    if (!r.visited) {
      r.visited = true;
      if (r.type === "spawn") {
        r.pickups.push(this.pickup("item", 480, 245, 1, this.randomItem()));
      }
      if (r.type === "treasure") {
        r.pickups.push(
          this.pickup("item", 405, 285, 1, this.randomItem()),
          this.pickup("item", 555, 285, 1, this.randomItem()),
          this.pickup("heart", 480, 375, 2),
        );
      }
      if (r.type === "shop") {
        r.pickups.push(
          this.pickup("item", 355, 310, 1, this.randomItem(), 12),
          this.pickup("item", 480, 310, 1, this.randomItem(), 16),
          this.pickup("item", 605, 310, 1, this.randomItem(), 20),
          this.pickup("heart", 480, 425, 3, undefined, 5),
        );
      }
    }
    if (this.locked) {
      // Clearing is far quicker than it used to be, so depth buys more waves
      // rather than tougher individual enemies.
      r.waves =
        r.type === "boss" ? 1 : r.distance >= 5 ? 4 : r.distance >= 3 ? 3 : 2;
      // The spawn telegraph is itself the readable delay, so the pre-wave wait
      // stays short instead of leaving the player standing in an empty room.
      this.waveDelay = TUNING.room.firstWaveDelay;
    }
    this.emit("room", 480, 300);
    this.dirty = true;
  }
  /**
   * Candidate spawn points that are clear of geometry and far enough from the
   * player that nothing can ever materialise on top of them.
   */
  spawnSpots(): Vec[] {
    const spots: Vec[] = [];
    for (const y of [150, 300, 450])
      for (const x of [175, 330, 480, 630, 790]) spots.push({ x, y });
    const safe = spots.filter(
      (s) =>
        distance(s, this.player) > TUNING.enemies.spawnDistance &&
        !this.room.obstacles.some((o) => overlaps(s, 26, o)),
    );
    return safe.length ? safe : [{ x: 480, y: 150 }];
  }
  spawnWave() {
    this.wave++;
    if (this.room.type === "boss") {
      this.enemies.push(
        makeEnemy(
          this.nextId++,
          "boss",
          { x: 480, y: 210 },
          this.room.distance,
        ),
      );
      this.toast("空冠守望者", "圣殿的最后一盏灯，正向你凝视。", 3);
      return;
    }
    const depth = this.room.distance,
      W = TUNING.waves;
    // Crowd size grows with depth and wave; per-enemy HP never does.
    const specials = clamp(
      Math.round(W.specialBase + depth * W.specialPerDepth),
      1,
      W.specialMax,
    );
    const swarm = clamp(
      Math.round(W.swarmBase + depth * W.swarmPerDepth + (this.wave - 1)),
      3,
      W.swarmMax,
    );
    const spots = this.spawnSpots();
    const kinds: EnemyKind[] = ["chaser", "shooter", "charger", "ring"];
    let placed = 0;
    const place = (kind: EnemyKind, spot: Vec, offset: number) => {
      const e = makeEnemy(
        this.nextId++,
        kind,
        {
          x: clamp(
            spot.x + ((offset % 3) - 1) * 27,
            BOUNDS.left + 30,
            BOUNDS.right - 30,
          ),
          y: clamp(
            spot.y + (offset % 2 ? 19 : -19),
            BOUNDS.top + 30,
            BOUNDS.bottom - 30,
          ),
        },
        depth,
      );
      // Inert, untouchable and marked on the floor while the telegraph plays.
      // Staggering it stops a large crowd from popping in on a single frame.
      e.spawnTime = TUNING.enemies.spawnWarning + (placed % 4) * 0.06;
      this.enemies.push(e);
      this.emit("spawn", e.x, e.y);
      placed++;
    };
    for (let i = 0; i < specials; i++)
      place(
        kinds[(this.room.id + this.wave + i) % 4],
        spots[(i * 3 + this.wave) % spots.length],
        i,
      );
    // Swarm enemies arrive in pods so they read as a crowd to cut through
    // rather than as scattered individual threats.
    for (let i = 0; i < swarm; i++)
      place(
        "swarm",
        spots[(specials * 3 + Math.floor(i / 3) * 2 + this.wave) % spots.length],
        i,
      );
    this.toast(
      `第 ${this.wave} / ${this.room.waves} 波`,
      "击败所有守卫以开启石门",
      1.8,
    );
  }
  clearRoom() {
    const r = this.room;
    if (r.cleared) return;
    r.cleared = true;
    this.bullets = [];
    this.waveDelay = 0;
    if (r.type === "boss") {
      this.mode = "won";
      this.emit("win", 480, 300);
      this.toast("余烬重燃", "空冠已碎，黎明正在门外。", 10);
      this.dirty = true;
      return;
    }
    this.clears++;
    if (!r.rewarded) {
      r.rewarded = true;
      const count = 5 + Math.min(4, r.distance);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        r.pickups.push(
          this.pickup("coin", 480 + Math.cos(a) * 46, 300 + Math.sin(a) * 46),
        );
      }
      if (this.player.hp < this.player.stats.maxHp || this.rng.next() < 0.45)
        r.pickups.push(this.pickup("heart", 525, 375, 2));
      // The first two clears always hand over a weapon-shaping relic, so the
      // build is already changing how shots look by the third room.
      if (this.clears <= 2)
        r.pickups.push(
          this.pickup("item", 435, 375, 1, this.randomItem(OFFENSIVE_ITEMS)),
        );
      else if (this.clears % 2 === 1)
        r.pickups.push(this.pickup("item", 435, 375, 1, this.randomItem()));
    }
    this.emit("clear", 480, 300);
    this.toast(
      "石门已开启",
      `守印 ${Math.min(3, this.clears)} / 3 · 收取奖励，继续深入`,
      3,
    );
    this.dirty = true;
  }
  grantItem(id: string) {
    const item = ITEM_BY_ID[id];
    if (!item) return;
    const before = activeCombos(this.player.items).length;
    this.player.items[id] = (this.player.items[id] || 0) + 1;
    this.player.stats = getStats(this.player.items);
    if (id === "vessel")
      this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + 2);
    if (id === "shell")
      this.player.shield = Math.min(
        this.player.stats.shield,
        this.player.shield + 1,
      );
    const combos = activeCombos(this.player.items);
    this.toast(`${item.name}  ×${this.player.items[id]}`, item.effect, 4);
    if (combos.length > before)
      this.toast(
        `组合觉醒 · ${combos[combos.length - 1].name}`,
        combos[combos.length - 1].effect,
        5,
      );
    this.emit("item", this.player.x, this.player.y);
    this.dirty = true;
  }
  collect(pick: Pickup) {
    if (pick.collected) return;
    if (pick.price > this.player.coins) {
      this.toast("金币不足", `还需要 ${pick.price - this.player.coins} 枚金币`);
      return;
    }
    if (pick.kind === "heart" && this.player.hp >= this.player.stats.maxHp) {
      if (pick.price) this.toast("生命已满", "这份补给可以留待之后。");
      return;
    }
    this.player.coins -= pick.price;
    pick.collected = true;
    if (pick.kind === "coin") {
      this.player.coins += pick.value;
      this.emit("coin", pick.x, pick.y);
    }
    if (pick.kind === "heart") {
      this.player.hp = Math.min(
        this.player.stats.maxHp,
        this.player.hp + pick.value,
      );
      this.emit("heal", pick.x, pick.y);
    }
    if (pick.kind === "item") this.grantItem(pick.item!);
    this.dirty = true;
  }
  hurtPlayer(damage: number, from: Vec) {
    const p = this.player;
    if (this.mode !== "playing" || p.invincible > 0 || p.dash > 0) return false;
    p.invincible = TUNING.player.invincible;
    if (p.shield > 0) {
      p.shield--;
      this.emit("shield", p.x, p.y);
      return true;
    }
    p.hp = Math.max(0, p.hp - damage);
    const n = normal(p.x - from.x, p.y - from.y);
    move(p, n.x * TUNING.player.knockback, n.y * TUNING.player.knockback, this.room.obstacles);
    this.emit("hurt", p.x, p.y);
    this.dirty = true;
    if (p.hp <= 0) {
      this.mode = "dead";
      this.bullets = [];
      this.emit("death", p.x, p.y);
    }
    return true;
  }
  addBullet(b:Bullet) {
    const limit=b.friendly?TUNING.limits.friendlyBullets:TUNING.limits.enemyBullets;
    if(this.spawnedThisTick>=TUNING.limits.spawnPerTick||this.bullets.filter(q=>q.life>0&&q.friendly===b.friendly).length>=limit){this.metrics.droppedBullets++;return false;}
    this.bullets.push(b);this.spawnedThisTick++;
    this.metrics.peakBullets=Math.max(this.metrics.peakBullets,this.bullets.length);
    return true;
  }
  effect(kind:CombatEffect['kind'],from:Vec,to:Vec=from,radius=0){
    const life=kind==='chain'?.16:.24;
    this.effects.push({kind,x:from.x,y:from.y,toX:to.x,toY:to.y,radius,life,maxLife:life});
    if(this.effects.length>TUNING.limits.effects)this.effects.shift();
  }
  enemyBullet(e: Vec, angle: number, speed: number) {
    this.addBullet({
      id: this.nextId++,
      x: e.x + Math.cos(angle) * 22,
      y: e.y + Math.sin(angle) * 22,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 6,
      damage: 1,
      friendly: false,
      life: 6,
      pierce: 0,
      bounce: 0,
      hit: [],
      frost: 0,
      homing: 0,
      blast: 0,
      split:0,chain:0,generation:0,splitDone:true,chainDone:true,family:{fragments:0,chains:0,blasts:0},
    });
  }
  shoot(x: number, y: number) {
    const p = this.player,
      s = p.stats;
    const angle = Math.atan2(y, x);
    p.facing = { x, y };
    p.fireCooldown += 1 / s.fireRate;
    p.firePulse=1;
    this.shots++;
    for (let i = -s.spread; i <= s.spread; i++) {
      const a = angle + i * TUNING.tear.spreadAngle;
      const inherit=normal(p.velocity.x,p.velocity.y);
      const speed=Math.min(TUNING.tear.inheritMax,Math.hypot(p.velocity.x,p.velocity.y)*TUNING.tear.inheritVelocity);
      this.addBullet({
        id: this.nextId++,
        x: p.x + Math.cos(a) * TUNING.tear.muzzle,
        y: p.y + Math.sin(a) * TUNING.tear.muzzle,
        vx: Math.cos(a) * TUNING.tear.speed+inherit.x*speed,
        vy: Math.sin(a) * TUNING.tear.speed+inherit.y*speed,
        r:
          TUNING.tear.radius +
          Math.min(
            TUNING.tear.maxSizeBonus,
            Math.max(0, s.damage - TUNING.tear.damage) *
              TUNING.tear.sizePerDamage,
          ),
        damage: s.damage,
        friendly: true,
        life: TUNING.tear.range/TUNING.tear.speed + s.bounce * 0.36,
        pierce: s.pierce+(p.items.prism&&p.items.needle?2:0),
        bounce: s.bounce,
        hit: [],
        frost: s.frost,
        homing: s.homing,
        blast: s.blast,
        split:s.split,chain:s.chain,generation:0,splitDone:false,chainDone:false,
        family:{fragments:TUNING.proc.fragmentsPerRoot,chains:Math.min(TUNING.proc.maxChainJumps,s.chain+1+(p.items.clock&&s.chain?2:0)),blasts:TUNING.proc.blastsPerRoot},
      });
    }
    this.emit("shoot", p.x, p.y);
  }
  tick(dt: number, input: Input) {
    if (this.mode !== "playing") return;
    this.spawnedThisTick=0;
    dt = clamp(dt, 0, 1 / 30);
    this.elapsed += dt;
    this.transition = Math.max(0, this.transition - dt);
    this.notice.time = Math.max(0, this.notice.time - dt);
    const p = this.player;
    p.invincible = Math.max(0, p.invincible - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.fireCooldown = Math.max(-dt, p.fireCooldown - dt);
    p.firePulse=Math.max(0,p.firePulse-dt*14);
    for(const fx of this.effects)fx.life-=dt;
    this.effects=this.effects.filter(fx=>fx.life>0);
    const v = normal(
      Number(input.right) - Number(input.left),
      Number(input.down) - Number(input.up),
    );
    if (input.dash && !this.lastDash && p.dashCooldown <= 0) {
      p.dash = TUNING.player.dashTime;
      p.dashCooldown = p.stats.dashCooldown;
      p.dashVector = v.x || v.y ? v : { ...p.facing };
      this.emit("dash", p.x, p.y);
    }
    this.lastDash = input.dash;
    const oldPosition = { x: p.x, y: p.y };
    if (v.x || v.y) p.moveFacing = v;
    if (p.dash > 0) {
      p.dash = Math.max(0, p.dash - dt);
      p.velocity = {
        x: p.dashVector.x * TUNING.player.dashSpeed,
        y: p.dashVector.y * TUNING.player.dashSpeed,
      };
      move(p, p.velocity.x * dt, p.velocity.y * dt, this.room.obstacles);
      // Exiting a dash drops straight back to walking speed. Letting the dash
      // velocity decay would read as drift, which is exactly what we don't want.
      if (p.dash <= 0) {
        const keep = v.x || v.y ? p.stats.speed : 0;
        p.velocity = { x: p.dashVector.x * keep, y: p.dashVector.y * keep };
      }
    } else {
      // Accelerate the velocity *vector* toward its target. Ramping each axis
      // independently would make diagonals briefly faster than cardinals.
      const targetX = v.x * p.stats.speed,
        targetY = v.y * p.stats.speed;
      const dx = targetX - p.velocity.x,
        dy = targetY - p.velocity.y;
      const gap = Math.hypot(dx, dy);
      const stepMag =
        (v.x || v.y ? TUNING.player.accel : TUNING.player.decel) * dt;
      if (gap <= stepMag) p.velocity = { x: targetX, y: targetY };
      else {
        p.velocity.x += (dx / gap) * stepMag;
        p.velocity.y += (dy / gap) * stepMag;
      }
      move(p, p.velocity.x * dt, p.velocity.y * dt, this.room.obstacles);
    }
    // A blocked axis has to lose its speed, otherwise the player charges stored
    // velocity into a wall and slingshots off it the moment they turn away.
    if (dt > 0) {
      const actualX = (p.x - oldPosition.x) / dt,
        actualY = (p.y - oldPosition.y) / dt;
      if (Math.abs(actualX) + 1 < Math.abs(p.velocity.x))
        p.velocity.x = actualX;
      if (Math.abs(actualY) + 1 < Math.abs(p.velocity.y))
        p.velocity.y = actualY;
    }
    if ((input.shootX || input.shootY) && p.fireCooldown <= 0)
      this.shoot(input.shootX, input.shootY);
    else if(!input.shootX&&!input.shootY)p.fireCooldown=Math.max(0,p.fireCooldown);
    if (this.waveDelay > 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) this.spawnWave();
    }
    updateEnemies(this, dt);
    updateBullets(this, dt);
    if (this.mode !== "playing") return;
    if (this.locked && this.waveDelay <= 0 && this.enemies.length === 0) {
      if (this.wave >= this.room.waves) this.clearRoom();
      else this.waveDelay = TUNING.room.betweenWaves;
    }
    if (this.mode !== "playing") return;
    for (const pick of this.room.pickups) {
      if (pick.collected) continue;
      const d = distance(p, pick);
      if (pick.kind === "coin" && pick.price === 0 && d < p.stats.magnet + 30) {
        const n = normal(p.x - pick.x, p.y - pick.y);
        const travel=Math.min(d,TUNING.room.magnetSpeed*dt);
        pick.x += n.x * travel;
        pick.y += n.y * travel;
      }
      if (pick.price === 0 && distance(p,pick)<TUNING.room.pickupRadius) this.collect(pick);
    }
    if (input.interact && !this.lastInteract) {
      const pick = this.room.pickups
        .filter((q) => !q.collected && q.price > 0 && distance(p, q) < 62)
        .sort((a, b) => distance(p, a) - distance(p, b))[0];
      if (pick) this.collect(pick);
    }
    this.lastInteract = input.interact;
    if (!this.locked && this.transition <= 0) {
      let dir: Direction | undefined;
      if (
        input.left &&
        p.x <= BOUNDS.left + p.r + 2 &&
        Math.abs(p.y - 300) < 36
      )
        dir = "west";
      if (
        input.right &&
        p.x >= BOUNDS.right - p.r - 2 &&
        Math.abs(p.y - 300) < 36
      )
        dir = "east";
      if (input.up && p.y <= BOUNDS.top + p.r + 2 && Math.abs(p.x - 480) < 36)
        dir = "north";
      if (
        input.down &&
        p.y >= BOUNDS.bottom - p.r - 2 &&
        Math.abs(p.x - 480) < 36
      )
        dir = "south";
      if (dir && this.room.doors[dir] !== undefined) {
        const id = this.room.doors[dir]!;
        if (this.rooms[id].type === "boss" && this.clears < 3) {
          if (this.notice.time < 1)
            this.toast(
              "圣殿仍被封印",
              `需要 3 枚守印，当前 ${this.clears} 枚。清理战斗房可获得。`,
            );
        } else this.enterRoom(id, dir);
      }
    }
  }
  snapshot() {
    const p = this.player;
    return {
      mode: this.mode,
      seed: this.seed,
      aimMode: this.aimMode,
      metrics: this.metrics,
      coordinates: "960x600; origin top-left, x right, y down",
      elapsed: Math.round(this.elapsed * 10) / 10,
      player: {
        x: Math.round(p.x),
        y: Math.round(p.y),
        hp: p.hp,
        coins: p.coins,
        shield: p.shield,
        invincible: p.invincible,
        dashCooldown: p.dashCooldown,
        stats: p.stats,
        velocity:p.velocity,aim:p.facing,moveFacing:p.moveFacing,collisionRadius:p.r,hurtRadius:p.hurtRadius,
        items: p.items,
      },
      room: {
        id: this.roomId,
        name: ROOM_NAMES[this.room.type],
        type: this.room.type,
        locked: this.locked,
        cleared: this.room.cleared,
        rewarded: this.room.rewarded,
        doors: this.room.doors,
        wave: this.wave,
        waves: this.room.waves,
        obstacles: this.room.obstacles,
      },
      enemies: this.enemies.map((e) => ({
        id: e.id,
        kind: e.kind,
        x: Math.round(e.x),
        y: Math.round(e.y),
        hp: Math.round(e.hp * 10) / 10,
        phase: e.phase,
        pattern: e.pattern,
        warning: e.warning,
        action: e.action,
        spawnTime:e.spawnTime,elite:e.elite,
      })),
      bullets: this.bullets.map((b) => ({
        x: Math.round(b.x),
        y: Math.round(b.y),
        friendly: b.friendly,
        vx: Math.round(b.vx),
        vy: Math.round(b.vy),
      })),
      pickups: this.room.pickups
        .filter((i) => !i.collected)
        .map((i) => ({
          ...i,
          name: i.item ? ITEM_BY_ID[i.item].name : i.kind,
        })),
      progress: {
        cleared: this.clears,
        seals: Math.min(3, this.clears),
        visited: this.rooms.filter((r) => r.visited).length,
        total: this.rooms.length,
        kills: this.kills,
        shots: this.shots,
      },
      map: this.rooms.map((r) => ({
        id: r.id,
        x: r.x,
        y: r.y,
        type: r.type,
        distance: r.distance,
        visited: r.visited,
        cleared: r.cleared,
        doors: r.doors,
      })),
      combos: activeCombos(p.items).map((c) => c.name),
      notice: this.notice.time > 0 ? this.notice : null,
    };
  }
}
