import Phaser from "phaser";
import { Game } from "../game/game.ts";
import { emptyInput } from "../game/types.ts";
import type { Input, AimMode } from "../game/types.ts";
import { normal } from "../game/physics.ts";
import { TUNING as T } from "../game/tuning.ts";
import { ITEM_BY_ID } from "../game/items.ts";
import { createArt, paintRoom } from "./art.ts";
import { AudioFX } from "./audio.ts";

const colors = {
  swarm: 0xb49cc4,
  chaser: 0x93b9a0,
  shooter: 0xcf96b7,
  charger: 0xdeab88,
  ring: 0xe4c27e,
  boss: 0xdcbf8f,
};
export class DungeonScene extends Phaser.Scene {
  model: Game;
  audioFX: AudioFX;
  keys = new Set<string>();
  mouseHeld=false;
  mouse={x:480,y:200,inside:false};
  shakeCooldown=0;
  manual = false;
  onFrame: () => void = () => {};
  gfx!: Phaser.GameObjects.Graphics;
  background!: Phaser.GameObjects.Image;
  hero!: Phaser.GameObjects.Image;
  sprites = new Map<number, Phaser.GameObjects.Image>();
  labels = new Map<number, Phaser.GameObjects.Text>();
  prices = new Map<number, Phaser.GameObjects.Text>();
  roomKey = "";
  accumulator = 0;
  visualTime = 0;
  ready = false;
  constructor(model: Game, audioFX: AudioFX) {
    super("Dungeon");
    this.model = model;
    this.audioFX = audioFX;
    try { this.model.aimMode=localStorage.getItem('ember-aim-mode')==='mouse'?'mouse':'arrows'; } catch { /* Private storage may be unavailable. */ }
  }
  clearInput(){this.keys.clear();this.mouseHeld=false;}
  setAimMode(mode:AimMode){this.clearInput();this.model.aimMode=mode;try{localStorage.setItem('ember-aim-mode',mode);}catch{}this.onFrame();}
  create() {
    createArt(this);
    this.background = this.add
      .image(0, 0, paintRoom(this, this.model.room, this.model.seed))
      .setOrigin(0);
    this.gfx = this.add.graphics();
    this.hero = this.add
      .image(480, 300, "player")
      .setScale(2.2)
      .setOrigin(0.5, 0.62)
      .setDepth(5);
    window.addEventListener("keydown", (e) => {
      if (
        e.target instanceof HTMLInputElement ||e.target instanceof HTMLSelectElement||
        document.querySelector("dialog[open]")
      )
        return;
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Space",
          "Escape",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
        ].includes(e.code)
      )
        e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat && e.code === "Escape") {
        this.model.togglePause();
        this.clearInput();
      }
      if (!e.repeat && e.code === "KeyM") this.audioFX.toggle();
      if (!e.repeat && e.code === "KeyF") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    const pointerMove=(e:PointerEvent)=>{
      const r=this.game.canvas.getBoundingClientRect();
      this.mouse={x:(e.clientX-r.left)/r.width*960,y:(e.clientY-r.top)/r.height*600,inside:e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom};
    };
    window.addEventListener('pointermove',pointerMove);
    this.game.canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0||this.model.mode!=='playing'||this.model.aimMode!=='mouse')return;
      pointerMove(e);this.mouseHeld=true;this.audioFX.unlock();e.preventDefault();this.game.canvas.setPointerCapture(e.pointerId);
    });
    window.addEventListener('pointerup',e=>{if(e.button===0)this.mouseHeld=false;});
    window.addEventListener('pointercancel',()=>this.mouseHeld=false);
    window.addEventListener("blur", () => {
      this.clearInput();
      if (this.model.mode === "playing") {
        this.model.togglePause();
        this.onFrame();
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.model.mode === "playing") {
        this.model.togglePause();
        this.clearInput();
        this.onFrame();
      }
    });
    this.game.canvas.setAttribute(
      "aria-label",
      "余烬深牢游戏画面：WASD 移动，方向键射击",
    );
    this.ready = true;
    this.draw(0);
    this.onFrame();
  }
  inputState(): Input {
    const k = this.keys;
    const i = emptyInput();
    i.up = k.has("KeyW");
    i.down = k.has("KeyS");
    i.left = k.has("KeyA");
    i.right = k.has("KeyD");
    i.dash = k.has("Space");
    i.interact = k.has("KeyE");
    if(document.querySelector('dialog[open]'))return emptyInput();
    if(this.model.aimMode==='mouse'){
      const p=this.model.player,aim=normal(this.mouse.x-p.x,this.mouse.y-p.y);
      if(this.mouseHeld&&(aim.x||aim.y)){i.shootX=aim.x;i.shootY=aim.y;}
    }else{
      // A newly pressed arrow wins immediately; releasing it resumes the held arrow.
      const arrow=[...k].reverse().find(key=>key.startsWith('Arrow'));
      if(arrow==='ArrowUp')i.shootY=-1;if(arrow==='ArrowDown')i.shootY=1;
      if(arrow==='ArrowLeft')i.shootX=-1;if(arrow==='ArrowRight')i.shootX=1;
    }
    return i;
  }
  advance(ms: number) {
    this.manual = true;
    const steps = Math.max(1, Math.ceil(ms / (1000 / 60)));
    for (let j = 0; j < steps; j++) {
      this.model.tick(ms / steps / 1000, this.inputState());
      this.draw(ms / steps / 1000);
    }
    this.onFrame();
  }
  update(_time: number, delta: number) {
    if (!this.ready) return;
    if (!this.manual) {
      this.accumulator += Math.min(delta, 80) / 1000;
      while (this.accumulator >= 1 / 60) {
        this.model.tick(1 / 60, this.inputState());
        this.accumulator -= 1 / 60;
      }
      this.draw(Math.min(delta, 50) / 1000);
    }
    this.onFrame();
  }
  draw(dt: number) {
    const m = this.model,
      p = m.player,
      g = this.gfx;
    if (!g) return;
    if (m.mode === "playing" || m.mode === "menu") this.visualTime += dt;
    const t = this.visualTime;
    this.shakeCooldown=Math.max(0,this.shakeCooldown-dt);
    const key = m.seed + ":" + m.roomId;
    if (key !== this.roomKey) {
      this.roomKey = key;
      this.background.setTexture("__WHITE");
      this.background.setTexture(paintRoom(this, m.room, m.seed));
      for (const s of this.sprites.values()) s.destroy();
      this.sprites.clear();
      for (const s of this.labels.values()) s.destroy();
      this.labels.clear();
      for (const s of this.prices.values()) s.destroy();
      this.prices.clear();
    }
    g.clear();
    // Entrances are drawn over the stone border, with destination colour.
    for (const [dir, id] of Object.entries(m.room.doors)) {
      const x = dir === "west" ? 54 : dir === "east" ? 906 : 480,
        y = dir === "north" ? 52 : dir === "south" ? 548 : 300;
      const horizontal = dir === "north" || dir === "south";
      const w = horizontal ? 88 : 40,
        h = horizontal ? 40 : 88;
      const target = m.rooms[id!];
      const sealed = target.type === "boss" && m.clears < 3;
      const color = m.locked
        ? 0x886454
        : target.type === "boss"
          ? 0xcf8273
          : target.type === "treasure"
            ? 0xc6b77b
            : target.type === "shop"
              ? 0xd5b073
              : 0x92bca0;
      g.fillStyle(0x101a17);
      g.fillRect(x - w / 2 - 5, y - h / 2 - 5, w + 10, h + 10);
      g.lineStyle(2, 0x5b6650);
      g.strokeRect(x - w / 2 - 4, y - h / 2 - 4, w + 8, h + 8);
      if (m.locked || sealed) {
        g.fillStyle(0x373c30);
        g.fillRect(x - w / 2, y - h / 2, w, h);
        g.lineStyle(3, color, 0.7);
        for (let i = -3; i <= 3; i++) {
          if (horizontal)
            g.lineBetween(x + i * 11, y - h / 2, x + i * 11, y + h / 2);
          else g.lineBetween(x - w / 2, y + i * 11, x + w / 2, y + i * 11);
        }
      } else {
        g.fillStyle(0x0a1512);
        g.fillRect(x - w / 2, y - h / 2, w, h);
        g.fillStyle(color, 0.1);
        g.fillRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8);
      }
      g.fillStyle(color);
      if (horizontal)
        g.fillTriangle(
          x,
          y + (dir === "north" ? -7 : 7),
          x - 5,
          y + (dir === "north" ? 2 : -2),
          x + 5,
          y + (dir === "north" ? 2 : -2),
        );
      else
        g.fillTriangle(
          x + (dir === "west" ? -7 : 7),
          y,
          x + (dir === "west" ? 2 : -2),
          y - 5,
          x + (dir === "west" ? 2 : -2),
          y + 5,
        );
    }
    // Four softly animated wall sconces.
    for (const [x, y] of [
      [156, 62],
      [804, 62],
      [156, 538],
      [804, 538],
    ]) {
      for (let r = 64; r > 8; r -= 8) {
        g.fillStyle(0xabc784, (0.007 * (64 - r)) / 8);
        g.fillCircle(x, y, r);
      }
      g.fillStyle(0x121d17);
      g.fillRect(x - 6, y + 2, 12, 9);
      g.fillStyle(0x829462);
      g.fillRect(x - 4, y + 2, 8, 3);
      g.fillStyle(0xa8c88b);
      g.fillRect(x - 3, y - 8 - Math.sin(t * 8 + x) * 2, 6, 9);
      g.fillStyle(0xf0dfaa);
      g.fillRect(x - 1, y - 5, 3, 6);
    }
    // Small floating dust; deterministic visual motion does not consume combat RNG.
    for (let i = 0; i < 20; i++) {
      g.fillStyle(0xb4bd91, 0.12 + 0.1 * Math.sin(t + i));
      g.fillRect(
        110 + ((i * 137) % 740) + Math.sin(t * 0.3 + i) * 10,
        85 + ((i * 73 + t * 4) % 425),
        2,
        2,
      );
    }
    if (
      m.room.type === "treasure" ||
      m.room.type === "shop" ||
      m.room.type === "spawn"
    ) {
      for (const pick of m.room.pickups.filter((q) => q.kind === "item")) {
        g.fillStyle(0x12201b, 0.8);
        g.fillEllipse(pick.x, pick.y + 12, 62, 21);
        g.fillStyle(0x48513c);
        g.fillRect(pick.x - 23, pick.y + 4, 46, 8);
        g.fillStyle(0x62684b);
        g.fillRect(pick.x - 19, pick.y, 38, 6);
      }
    }
    if (m.room.type === "treasure") {
      const open = m.room.pickups
        .filter((q) => q.kind === "item")
        .every((q) => q.collected);
      g.fillStyle(0x0b1812, 0.55);
      g.fillEllipse(480, 217, 73, 24);
      g.fillStyle(0x3f3020);
      g.fillRect(451, 191, 58, 25);
      g.fillStyle(0x765c37);
      g.fillRect(454, 194, 52, 18);
      g.fillStyle(0xb59a5c);
      g.fillRect(457, 194, 4, 18);
      g.fillRect(499, 194, 4, 18);
      g.fillRect(453, open ? 175 : 184, 54, open ? 12 : 13);
      g.fillStyle(0x887244);
      g.fillRect(458, open ? 177 : 186, 44, 7);
      g.fillStyle(0xe0c984);
      g.fillRect(477, 193, 6, 7);
      if (open) {
        g.fillStyle(0x142319);
        g.fillRect(457, 191, 46, 6);
      }
    }
    if (m.room.type === "shop") {
      g.fillStyle(0x0a160f, 0.5);
      g.fillEllipse(480, 207, 62, 20);
      g.fillStyle(0x343f35);
      g.fillTriangle(480, 152, 456, 207, 504, 207);
      g.fillStyle(0x607062);
      g.fillRect(469, 161, 22, 24);
      g.fillStyle(0x1c2d23);
      g.fillRect(472, 166, 16, 12);
      g.fillStyle(0xdcc697);
      g.fillRect(474, 170, 3, 2);
      g.fillRect(483, 170, 3, 2);
      g.fillStyle(0x7d6b45);
      g.fillRect(442, 210, 76, 10);
      g.fillStyle(0xb4a273);
      g.fillRect(443, 208, 74, 3);
      g.fillStyle(0x534f30);
      g.fillRect(447, 220, 7, 10);
      g.fillRect(506, 220, 7, 10);
    }
    for (const e of m.enemies) {
      if(e.spawnTime>0){g.lineStyle(2,0xdbbc80,.6);g.strokeCircle(e.x,e.y,12+e.spawnTime*26);g.lineBetween(e.x-7,e.y,e.x+7,e.y);g.lineBetween(e.x,e.y-7,e.x,e.y+7);}
      if (e.warning > 0) {
        const a = Math.atan2(e.aim.y, e.aim.x);
        const charge =
          e.kind === "charger" ||e.kind==='swarm'||
          e.kind === "chaser" ||
          (e.kind === "boss" && e.pattern % 3 === 2);
        if (charge) {
          const len = e.kind === "chaser" ? 90 : 320,
            perp = { x: -e.aim.y * 19, y: e.aim.x * 19 };
          g.fillStyle(0xef9979, 0.14 + 0.09 * Math.sin(t * 22));
          g.fillPoints(
            [
              { x: e.x + perp.x, y: e.y + perp.y },
              { x: e.x - perp.x, y: e.y - perp.y },
              {
                x: e.x + e.aim.x * len - perp.x,
                y: e.y + e.aim.y * len - perp.y,
              },
              {
                x: e.x + e.aim.x * len + perp.x,
                y: e.y + e.aim.y * len + perp.y,
              },
            ],
            true,
          );
          g.lineStyle(1, 0xf5b585, 0.8);
          g.lineBetween(e.x, e.y, e.x + e.aim.x * len, e.y + e.aim.y * len);
        } else if (
          e.kind === "ring" ||
          (e.kind === "boss" && e.pattern % 3 === 0)
        ) {
          g.lineStyle(2, 0xeeae83, 0.65);
          g.strokeCircle(e.x, e.y, e.r + 25 + Math.sin(t * 13) * 4);
          for (let j = 0; j < 10; j++) {
            const a = (j / 10) * 6.283;
            g.lineBetween(
              e.x + Math.cos(a) * (e.r + 32),
              e.y + Math.sin(a) * (e.r + 32),
              e.x + Math.cos(a) * (e.r + 44),
              e.y + Math.sin(a) * (e.r + 44),
            );
          }
        } else {
          g.fillStyle(0xf59585, 0.15);
          g.fillTriangle(
            e.x,
            e.y,
            e.x + Math.cos(a - 0.55) * 170,
            e.y + Math.sin(a - 0.55) * 170,
            e.x + Math.cos(a + 0.55) * 170,
            e.y + Math.sin(a + 0.55) * 170,
          );
        }
      }
      g.fillStyle(0x07130f, 0.55);
      g.fillEllipse(e.x, e.y + e.r * 0.8, e.r * 2.8, e.r * 0.95);
      let s = this.sprites.get(e.id);
      if (!s) {
        s = this.add
          .image(e.x, e.y, e.kind)
          .setScale(e.kind === "boss" ? 3 : e.kind === "swarm" ? 1.7 : 2.1)
          .setOrigin(0.5, 0.58)
          .setDepth(4);
        this.sprites.set(e.id, s);
      }
      s.setPosition(
        Math.round(e.x),
        Math.round(e.y + Math.sin(t * 5 + e.id) * 1.5),
      );
      s.setAlpha(e.spawnTime>0?.2:.999);
      if(e.elite){g.lineStyle(1,0xe8b56b,.75);g.strokeCircle(e.x,e.y,e.r+10);}
      if (e.flash > 0) s.setTintFill(0xffffff);
      else {
        s.clearTint();
        if (e.slow > 0) s.setTint(0x9bdde3);
      }
      if (e.hp < e.maxHp && e.kind !== "boss") {
        g.fillStyle(0x101b17);
        g.fillRect(e.x - 18, e.y - 30, 36, 4);
        g.fillStyle(colors[e.kind]);
        g.fillRect(e.x - 18, e.y - 30, 36 * Math.max(0, e.hp / e.maxHp), 3);
      }
    }
    const liveIds = new Set(m.enemies.map((e) => e.id));
    for (const [id, s] of this.sprites)
      if (!liveIds.has(id)) {
        s.destroy();
        this.sprites.delete(id);
      }
    // Chain arcs, blasts and frost bursts. These are simulation-owned effects;
    // without drawing them the combos land invisibly.
    for (const fx of m.effects) {
      const k = Math.max(0, fx.life / fx.maxLife);
      if (fx.kind === "chain") {
        const dx = fx.toX - fx.x,
          dy = fx.toY - fx.y;
        g.lineStyle(1.5 + k * 2.2, 0xc3d4ff, 0.3 + k * 0.6);
        let px = fx.x,
          py = fx.y;
        for (let i = 1; i <= 5; i++) {
          const at = i / 5;
          const wobble = i === 5 ? 0 : Math.sin(i * 2.6 + fx.maxLife * 90) * 0.07;
          const nx = fx.x + dx * at - dy * wobble,
            ny = fx.y + dy * at + dx * wobble;
          g.lineBetween(px, py, nx, ny);
          px = nx;
          py = ny;
        }
      } else {
        const color = fx.kind === "blast" ? 0xffb073 : 0x9ae0ee;
        const radius = fx.radius * (1.06 - k * 0.26);
        g.fillStyle(color, 0.16 * k);
        g.fillCircle(fx.x, fx.y, radius);
        g.lineStyle(2.5, color, 0.28 + k * 0.5);
        g.strokeCircle(fx.x, fx.y, radius);
      }
    }
    // Tears, not dots: a round head facing travel with a tapered tail behind it,
    // so direction and speed are readable at a glance.
    for (const b of m.bullets) {
      const c = b.friendly ? 0x9ef1de : 0xff947e;
      const speed = Math.hypot(b.vx, b.vy) || 1;
      const hx = b.vx / speed,
        hy = b.vy / speed;
      const px = -hy,
        py = hx;
      const tail = b.r * 2.6;
      g.fillStyle(c, 0.1);
      g.fillCircle(b.x, b.y, b.r + 5.5);
      const shape = (width: number, length: number) => {
        g.fillPoints(
          [
            { x: b.x + px * width, y: b.y + py * width },
            { x: b.x - hx * length, y: b.y - hy * length },
            { x: b.x - px * width, y: b.y - py * width },
          ],
          true,
        );
      };
      g.fillStyle(0x0d1a17);
      shape(b.r + 1.2, tail + 1.8);
      g.fillCircle(b.x, b.y, b.r + 1.2);
      g.fillStyle(c);
      shape(b.r, tail);
      g.fillCircle(b.x, b.y, b.r);
      g.fillStyle(b.friendly ? 0xeffff6 : 0xffe6b5);
      g.fillCircle(
        b.x + px * b.r * 0.3 + hx * b.r * 0.12,
        b.y + py * b.r * 0.3 + hy * b.r * 0.12,
        b.r * 0.4,
      );
    }
    const pickIds = new Set<number>();
    for (const pick of m.room.pickups) {
      if (pick.collected) continue;
      pickIds.add(pick.id);
      const y = pick.y + Math.sin(t * 3 + pick.id) * 3;
      if (pick.price > 0) {
        let price = this.prices.get(pick.id);
        if (!price) {
          price = this.add
            .text(pick.x, pick.y + 32, `◈ ${pick.price}`, {
              fontFamily: "Consolas, monospace",
              fontSize: "13px",
              color: "#dbc38d",
              backgroundColor: "#1c281b",
              padding: { x: 5, y: 2 },
            })
            .setOrigin(0.5)
            .setDepth(6);
          this.prices.set(pick.id, price);
        }
      }
      if (pick.kind === "coin") {
        g.fillStyle(0x0e1a13, 0.6);
        g.fillEllipse(pick.x, pick.y + 8, 15, 6);
        g.fillStyle(0xb58b4f);
        g.fillRect(pick.x - 5, y - 6, 10, 12);
        g.fillStyle(0xf2d18a);
        g.fillRect(pick.x - 5, y - 6, 8, 9);
        g.fillStyle(0x9f7d45);
        g.fillRect(pick.x - 1, y - 4, 2, 5);
      } else if (pick.kind === "heart") {
        g.fillStyle(0xe99899);
        g.fillRect(pick.x - 7, y - 3, 6, 6);
        g.fillRect(pick.x + 1, y - 3, 6, 6);
        g.fillTriangle(pick.x - 7, y + 1, pick.x + 7, y + 1, pick.x, y + 10);
      } else {
        const item = ITEM_BY_ID[pick.item!],
          color = Phaser.Display.Color.HexStringToColor(item.color).color;
        g.fillStyle(color, 0.07);
        g.fillCircle(pick.x, y, 32);
        g.lineStyle(1, color, 0.4);
        g.strokeCircle(pick.x, y, 17);
        g.fillStyle(0x172620);
        g.fillRect(pick.x - 10, y - 10, 20, 20);
        g.lineStyle(1, color);
        g.strokeRect(pick.x - 10, y - 10, 20, 20);
        let label = this.labels.get(pick.id);
        if (!label) {
          label = this.add
            .text(pick.x, y, item.icon, {
              fontFamily: "Georgia, serif",
              fontSize: "22px",
              color: item.color,
            })
            .setOrigin(0.5)
            .setDepth(6);
          this.labels.set(pick.id, label);
        }
        label.setY(y);
      }
    }
    for (const [id, s] of this.labels)
      if (!pickIds.has(id)) {
        s.destroy();
        this.labels.delete(id);
      }
    for (const [id, s] of this.prices)
      if (!pickIds.has(id)) {
        s.destroy();
        this.prices.delete(id);
      }
    if (p.dash > 0) {
      g.fillStyle(0xa9edce, 0.2);
      g.fillEllipse(
        p.x - p.dashVector.x * 24,
        p.y - p.dashVector.y * 24,
        30,
        32,
      );
      g.fillStyle(0xa9edce, 0.1);
      g.fillEllipse(
        p.x - p.dashVector.x * 46,
        p.y - p.dashVector.y * 46,
        24,
        28,
      );
    }
    g.fillStyle(0x04130d, 0.58);
    g.fillEllipse(p.x, p.y + 16, 39, 15);
    if (p.shield > 0) {
      g.lineStyle(1.5, 0xb6d9b4, 0.55);
      g.strokeCircle(p.x, p.y, 27 + Math.sin(t * 3) * 2);
    }
    this.hero
      .setPosition(
        Math.round(p.x),
        Math.round(p.y + (p.dash > 0 ? 0 : Math.sin(t * 4) * 1.3)),
      )
      .setAlpha(p.invincible > 0 && Math.floor(t * 16) % 2 === 0 ? 0.4 : 1)
      .setVisible(m.mode !== "dead");
    // A small lantern at the firing hand visually marks the shot direction.
    const handX = p.x + p.facing.x * 19 + (!p.facing.x ? 15 : 0),
      handY = p.y + p.facing.y * 15 + 4;
    if (m.mode !== "dead") {
      g.fillStyle(0x8a724d);
      g.fillRect(handX - 4, handY - 5, 8, 11);
      g.fillStyle(0xf5d193);
      g.fillRect(handX - 2, handY - 3, 4, 6);
    }
    for (const event of m.events.splice(0)) {
      this.audioFX.play(event.kind);
      // Ordinary hits never shake the camera — that is what makes a hit read as
      // a hit rather than as noise. Kills and blasts do, but on a cooldown, so
      // mowing down a crowd never turns into a strobe.
      const heavy = event.kind === "hurt" || event.kind === "phase";
      const solid =
        event.kind === "blast" ||
        (event.kind === "kill" && event.value >= 2) ||
        event.kind === "win";
      const light = event.kind === "kill";
      if (!this.manual && (heavy || this.shakeCooldown <= 0)) {
        if (heavy) {
          this.cameras.main.shake(120, 0.0032);
          this.shakeCooldown = T.feedback.shakeInterval;
        } else if (solid) {
          this.cameras.main.shake(70, 0.0015);
          this.shakeCooldown = T.feedback.killShakeInterval;
        } else if (light) {
          this.cameras.main.shake(45, 0.0007);
          this.shakeCooldown = T.feedback.killShakeInterval;
        }
      }
      const color =
        event.kind === "hurt" || event.kind === "kill"
          ? 0xd99680
          : event.kind === "coin" ||
              event.kind === "item" ||
              event.kind === "clear"
            ? 0xe1c38b
            : 0xb4ead9;
      // A hit throws a few fast, short-lived shards; a kill throws a real burst
      // scaled by how big the target was.
      const isKill = event.kind === "kill",
        isHit = event.kind === "hit";
      const amount = isKill
        ? 12 + event.value * 7
        : ["item", "phase", "clear"].includes(event.kind)
          ? 16
          : ["hurt", "blast", "frost"].includes(event.kind)
            ? 7
            : isHit
              ? 6
              : 3;
      const burst = isKill ? 105 : isHit ? 120 : 35;
      const spread = isKill ? 34 : isHit ? 30 : 22;
      for (let i = 0; i < amount; i++) {
        const a = i * 2.399 + t * 7,
          speed = burst + (i % 5) * spread;
        const life = (isHit ? 0.11 : 0.25) + (i % 4) * (isHit ? 0.05 : 0.12);
        m.particles.push({
          x: event.x,
          y: event.y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life,
          maxLife: life,
          color,
          size: (i % 3) + 1,
        });
      }
      if (
        event.value > 0 &&
        (event.kind === "blast" || event.kind === "frost")
      ) {
        g.lineStyle(2, color, 0.7);
        g.strokeCircle(event.x, event.y, event.value);
      }
    }
    if (m.mode === "playing")
      for (const q of m.particles) {
        q.life -= dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= 0.97;
        q.vy *= 0.97;
      }
    m.particles = m.particles.filter((q) => q.life > 0).slice(-350);
    for (const q of m.particles) {
      g.fillStyle(q.color, Math.max(0, q.life / q.maxLife));
      g.fillRect(q.x, q.y, q.size + 1, q.size + 1);
    }
    if (m.transition > 0.2) {
      g.fillStyle(0x0e1915, ((m.transition - 0.2) / 0.3) * 0.8);
      g.fillRect(0, 0, 960, 600);
    }
  }
}
