import type { Game } from "../game/game.ts";
import type { DungeonScene } from "../render/scene.ts";
import type { AudioFX } from "../render/audio.ts";
import { ITEMS, ITEM_BY_ID, COMBOS, activeCombos } from "../game/items.ts";
import { ROOM_NAMES } from "../game/types.ts";
import { distance } from "../game/physics.ts";

const byId = (id: string) => document.getElementById(id)!;
const time = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
const safe = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export class HUD {
  game: Game;
  scene: DungeonScene;
  audio: AudioFX;
  lastMode = "";
  lastSignature = "";
  codex = false;
  constructor(game: Game, scene: DungeonScene, audio: AudioFX) {
    this.game = game;
    this.scene = scene;
    this.audio = audio;
    this.mount();
  }
  mount() {
    byId("app").innerHTML = `
      <header class="site-header"><div class="brand"><span class="brand-mark">◈</span><div><h1>余烬深牢<span>EMBER VAULT</span></h1><p>带着最后一盏灯，走进未知。</p></div></div><nav><span class="edition"><i></i> A DUNGEON ROGUELITE</span><button id="codex-btn" class="icon-button" title="查看${ITEMS.length}种遗物与${COMBOS.length}组组合">◇ <span>遗物图鉴</span></button><button id="aim-btn" class="icon-button" title="切换瞄准方式">✛ <span>方向键瞄准</span></button><button id="sound-btn" class="icon-button" title="M 切换音效">♪ <span>音效开启</span></button><button id="pause-btn" class="icon-button" title="Esc 暂停游戏">Ⅱ</button></nav></header>
      <main class="game-frame"><div class="run-bar"><div class="vitals"><span class="overline">守灯人</span><div id="hearts"></div><span id="hp-label"></span></div><div class="run-numbers"><div><span class="gold">◈</span> <b id="coins">06</b><small>金币</small></div><span class="bar-divider"></span><div><span class="muted">◷</span> <b id="timer">00:00</b></div><span class="bar-divider"></span><div class="seal-counter"><span>♜</span><b id="seals">0 / 3</b><small>守印</small></div></div></div>
      <div class="play-layout"><section class="stage"><div id="phaser-game"></div><div class="room-heading"><span id="room-category">I · 静谧之地</span><h2 id="room-name">守灯人的避所</h2></div><div id="room-status" class="room-status"></div><div id="toast" class="toast hidden" role="status"><span class="toast-icon">✦</span><div><strong></strong><p></p></div></div><div id="pickup-hint" class="pickup-hint hidden"></div><div id="boss-bar" class="boss-bar hidden"><div><span>空冠守望者</span><small id="boss-phase">第一阶段</small></div><div class="boss-track"><i></i></div></div><div class="dash-indicator"><span>SPACE</span><div><i id="dash-fill"></i></div><small id="dash-label">冲刺就绪</small></div><div id="overlay" class="overlay"></div></section>
      <aside class="sidebar"><section class="map-panel"><div class="section-title"><h3>地牢地图</h3><span id="explored">01 / 12</span></div><div id="minimap"></div><div class="map-legend"><span><i class="legend-you"></i>当前</span><span><i class="legend-gold"></i>遗物 / 商店</span><span><i class="legend-boss"></i>守望者</span></div></section><section class="stats-panel"><div class="section-title"><h3>守灯人属性</h3><span>ATTRIBUTES</span></div><div id="stats" class="stats-grid"></div></section><section class="relic-panel"><div class="section-title"><h3>已持有遗物</h3><span id="item-count">0</span></div><div id="inventory" class="inventory"></div><p id="empty-inventory">拾起遗物，让灯火变得不同。</p><div id="combos" class="combos"></div></section><section class="objective"><span class="overline">此行的终点</span><p id="objective">收集 3 枚守印<br/>击败空冠守望者 <span>↗</span></p></section></aside></div>
      <footer class="controls"><div><span class="keygroup"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><label>移动</label></div><div><span class="keygroup" id="aim-keys"><kbd>↑</kbd><span><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span></span><label id="aim-label">射击</label></div><div><kbd class="wide">SPACE</kbd><label>冲刺 / 闪避</label></div><div><kbd>E</kbd><label>购买</label></div><div><kbd>ESC</kbd><label>暂停</label></div><div><kbd>F</kbd><label>全屏</label></div><span class="controls-note">青色是你的灯火 · 珊瑚红是危险</span></footer></main>
      <footer class="page-footer"><span><i></i> 每一次深入，都是新的命运。</span><span id="seed-label">SEED · LANTERN-01</span><span>原创像素地牢 <b>✦</b> 一命到底，死了就重来</span></footer><dialog id="codex"><button id="close-codex" class="close">×</button><span class="overline">THE RELIQUARY</span><h2>遗物图鉴</h2><p>所有遗物都可叠加。让不同的力量在灯火中相遇。</p><div class="codex-items">${ITEMS.map((i) => `<article><span style="color:${i.color}">${i.icon}</span><div><h3>${i.name}</h3><p>${i.effect}</p></div></article>`).join("")}</div><h3 class="combo-title">${COMBOS.length} 组组合觉醒</h3><div class="codex-combos">${COMBOS.map((c) => `<article><strong>${c.name}</strong><small>${c.needs.map((id) => ITEM_BY_ID[id].name).join(" + ")}</small><p>${c.effect}</p></article>`).join("")}</div></dialog>`;
    byId("pause-btn").onclick = () => {
      this.game.togglePause();
      this.scene.keys.clear();
      this.update();
    };
    byId("sound-btn").onclick = () => {
      this.audio.toggle();
      this.update();
    };
    byId("aim-btn").onclick = () => {
      this.scene.setAimMode(
        this.game.aimMode === "arrows" ? "mouse" : "arrows",
      );
      this.update();
    };
    byId("codex-btn").onclick = () => {
      this.codex = true;
      if (this.game.mode === "playing") this.game.togglePause();
      this.scene.keys.clear();
      (byId("codex") as HTMLDialogElement).showModal();
      this.update();
    };
    byId("close-codex").onclick = () => {
      this.codex = false;
      (byId("codex") as HTMLDialogElement).close();
    };
    (byId("codex") as HTMLDialogElement).addEventListener("cancel", (e) => {
      e.preventDefault();
      this.codex = false;
      (byId("codex") as HTMLDialogElement).close();
    });
  }
  start(seed: string) {
    this.audio.unlock();
    this.scene.keys.clear();
    this.scene.accumulator = 0;
    this.game.reset(seed);
    this.scene.roomKey = "";
    this.scene.draw(0);
    this.lastSignature = "";
    this.update();
  }
  menu() {
    const m = this.game,
      mode = m.mode,
      overlay = byId("overlay");
    if (mode === this.lastMode) return;
    this.lastMode = mode;
    overlay.classList.toggle("hidden", mode === "playing");
    if (mode === "playing") {
      overlay.innerHTML = "";
      return;
    }
    if (mode === "menu") {
      overlay.innerHTML = `<div class="menu-card start-card"><div class="menu-emblem"><span>◈</span></div><span class="overline">THE LIGHT REMEMBERS</span><h2>余烬深牢</h2><div class="menu-subtitle"><i></i> EMBER VAULT <i></i></div><p class="menu-story">长夜吞没了圣殿。<br/>你是最后的守灯人，也是尚未熄灭的余烬。</p><button id="start-btn" class="primary">点亮灯火，开始探索 <span>↗</span></button><div class="seed-input"><label for="seed-input">地牢种子</label><input id="seed-input" maxlength="40" value="${safe(m.seed)}" spellcheck="false" autocomplete="off"/><button id="random-seed" title="生成随机种子">⟳</button></div><p class="menu-footnote">随机地牢 · 遗物构筑 · 一命到底</p></div>`;
      byId("random-seed").onclick = () => {
        (byId("seed-input") as HTMLInputElement).value =
          `EMBER-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase()}`;
      };
      byId("start-btn").onclick = () =>
        this.start((byId("seed-input") as HTMLInputElement).value);
      byId("seed-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          byId("start-btn").click();
        }
      });
    } else if (mode === "paused") {
      overlay.innerHTML = `<div class="menu-card compact-card"><div class="small-emblem">Ⅱ</div><span class="overline">A MOMENT BY THE FIRE</span><h2>灯火暂歇</h2><p>深牢会等你。准备好后，继续前行。</p><button id="resume-btn" class="primary">继续探索 <span>↗</span></button><button id="restart-btn" class="secondary">以相同种子重新开始</button><small>ESC 继续 · M 切换音效</small></div>`;
      byId("resume-btn").onclick = () => {
        this.game.togglePause();
        this.scene.keys.clear();
        this.audio.unlock();
        this.update();
      };
      byId("restart-btn").onclick = () => this.start(m.seed);
    } else {
      const win = mode === "won";
      overlay.innerHTML = `<div class="menu-card compact-card ${win ? "victory" : "defeat"}"><div class="small-emblem">${win ? "✦" : "◇"}</div><span class="overline">${win ? "THE DAWN IS YOURS" : "THE FLAME WILL RETURN"}</span><h2>${win ? "余烬重燃" : "灯火已熄"}</h2><p>${win ? "空冠已碎。你将第一缕晨光带回了深牢。" : "长夜记住了你的名字。再点亮一次灯火吧。"}</p><div class="end-stats"><div><strong>${time(m.elapsed)}</strong><small>探索时间</small></div><div><strong>${m.kills}</strong><small>击败守卫</small></div><div><strong>${Object.values(m.player.items).reduce((a, b) => a + b, 0)}</strong><small>收集遗物</small></div></div><button id="restart-btn" class="primary">再燃一次 · 相同种子 <span>↻</span></button><button id="new-run-btn" class="secondary">探索全新的地牢 ↗</button></div>`;
      byId("restart-btn").onclick = () => this.start(m.seed);
      byId("new-run-btn").onclick = () =>
        this.start(
          `EMBER-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase()}`,
        );
    }
  }
  update() {
    const m = this.game,
      p = m.player;
    this.menu();
    byId("timer").textContent = time(m.elapsed);
    byId("dash-fill").style.width =
      `${(1 - p.dashCooldown / p.stats.dashCooldown) * 100}%`;
    byId("dash-label").textContent =
      p.dashCooldown > 0 ? `${p.dashCooldown.toFixed(1)}s` : "冲刺就绪";
    byId("sound-btn").innerHTML =
      `${this.audio.enabled ? "♪" : "♩"} <span>${this.audio.enabled ? "音效开启" : "音效关闭"}</span>`;
    const mouseAim = m.aimMode === "mouse";
    byId("aim-btn").innerHTML =
      `${mouseAim ? "⌖" : "✛"} <span>${mouseAim ? "鼠标瞄准" : "方向键瞄准"}</span>`;
    byId("aim-keys").innerHTML = mouseAim
      ? `<kbd class="wide">鼠标左键</kbd>`
      : `<kbd>↑</kbd><span><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span>`;
    byId("aim-label").textContent = mouseAim ? "瞄准并射击" : "射击";
    const boss = m.enemies.find((e) => e.kind === "boss");
    byId("boss-bar").classList.toggle("hidden", !boss);
    if (boss) {
      byId("boss-phase").textContent =
        `${boss.phase === 1 ? "I · 空冠之躯" : "II · 灰烬觉醒"}  ${Math.ceil(boss.hp)} / ${boss.maxHp}`;
      (byId("boss-bar").querySelector("i") as HTMLElement).style.width =
        `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
    }
    const toast = byId("toast");
    toast.classList.toggle(
      "hidden",
      m.notice.time <= 0 || m.mode !== "playing",
    );
    toast.querySelector("strong")!.textContent = m.notice.title;
    toast.querySelector("p")!.textContent = m.notice.description;
    const near = m.room.pickups
      .filter((q) => !q.collected && distance(q, p) < 80 && q.kind !== "coin")
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    const hint = byId("pickup-hint");
    hint.classList.toggle("hidden", !near || m.mode !== "playing");
    if (near) {
      const name = near.item ? ITEM_BY_ID[near.item].name : "温热补给";
      const desc = near.item
        ? ITEM_BY_ID[near.item].effect
        : `回复 ${near.value} 生命`;
      hint.innerHTML = `<strong>${name}</strong><span>${desc}</span><small>${near.price ? `<kbd>E</kbd> 购买 · ◈ ${near.price}` : "靠近拾取"}</small>`;
    }
    const signature = [
      m.roomId,
      m.seed,
      p.hp,
      p.coins,
      p.shield,
      m.clears,
      m.wave,
      m.enemies.length,
      m.mode,
      JSON.stringify(p.items),
    ].join("|");
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    byId("hearts").innerHTML =
      Array.from(
        { length: p.stats.maxHp },
        (_, i) => `<span class="heart ${i < p.hp ? "filled" : ""}">♥</span>`,
      ).join("") +
      (p.shield ? `<span class="shield">⬡ ${p.shield}</span>` : "");
    byId("hp-label").textContent = `${p.hp}/${p.stats.maxHp}`;
    byId("coins").textContent = p.coins.toString().padStart(2, "0");
    byId("seals").textContent = `${Math.min(3, m.clears)} / 3`;
    byId("room-name").textContent = ROOM_NAMES[m.room.type];
    byId("room-category").textContent =
      `${String(m.roomId + 1).padStart(2, "0")} · ${m.room.type === "boss" ? "最后的圣殿" : m.room.type === "spawn" ? "静谧之地" : m.room.type === "treasure" ? "失落的馈赠" : m.room.type === "shop" ? "灯下交易" : `地牢深度 ${m.room.distance}`}`;
    byId("room-status").innerHTML = m.locked
      ? `<i class="danger-dot"></i> 石门封锁 <span>${m.wave}/${m.room.waves} 波 · ${m.enemies.length} 敌人</span>`
      : `<i></i> ${m.room.type === "battle" ? "房间已清理" : "安全区域"}`;
    byId("explored").textContent =
      `${String(m.rooms.filter((r) => r.visited).length).padStart(2, "0")} / ${m.rooms.length}`;
    const s = p.stats;
    byId("stats").innerHTML = [
      ["↗", "伤害", s.damage.toFixed(1)],
      ["◷", "射速", s.fireRate.toFixed(1) + "/s"],
      ["»", "移速", Math.round(s.speed)],
      ["⌁", "穿透", s.pierce],
      ["◇", "散射", 1 + s.spread * 2],
      ["↶", "弹射", s.bounce],
    ]
      .map(
        ([icon, label, value]) =>
          `<div><span>${icon}</span><small>${label}</small><b>${value}</b></div>`,
      )
      .join("");
    const owned = Object.entries(p.items);
    byId("inventory").innerHTML = owned
      .map(([id, n]) => {
        const i = ITEM_BY_ID[id];
        return `<div class="relic" tabindex="0" aria-label="${i.name} ×${n}，${i.effect}" style="--relic-color:${i.color}"><span>${i.icon}</span><b>${n}</b><div class="relic-tooltip"><strong>${i.name} ×${n}</strong><p>${i.effect}</p></div></div>`;
      })
      .join("");
    byId("empty-inventory").classList.toggle("hidden", owned.length > 0);
    byId("item-count").textContent = Object.values(p.items)
      .reduce((a, b) => a + b, 0)
      .toString();
    byId("combos").innerHTML = activeCombos(p.items)
      .map(
        (c) => `<div title="${c.effect}">✦ ${c.name}<span>已觉醒</span></div>`,
      )
      .join("");
    byId("objective").innerHTML =
      m.clears >= 3
        ? "守印已集齐<br/>前往空冠圣殿 <span>↗</span>"
        : `收集 3 枚守印 <small>(${Math.min(3, m.clears)}/3)</small><br/>击败空冠守望者 <span>↗</span>`;
    byId("seed-label").textContent = `SEED · ${m.seed}`;
    this.map();
  }
  map() {
    const m = this.game,
      minX = Math.min(...m.rooms.map((r) => r.x)),
      maxX = Math.max(...m.rooms.map((r) => r.x)),
      minY = Math.min(...m.rooms.map((r) => r.y)),
      maxY = Math.max(...m.rooms.map((r) => r.y));
    const w = (maxX - minX + 1) * 32 + 16,
      h = (maxY - minY + 1) * 28 + 16;
    let content = "";
    const pos = (r: { x: number; y: number }) => ({
      x: (r.x - minX) * 32 + 24,
      y: (r.y - minY) * 28 + 22,
    });
    for (const r of m.rooms)
      for (const id of Object.values(r.doors)) {
        if (id! > r.id) {
          const a = pos(r),
            b = pos(m.rooms[id!]);
          content += `<path d="M${a.x} ${a.y} L${b.x} ${b.y}" stroke="${r.visited ? "#61755b" : "#303e32"}" stroke-width="3"/>`;
        }
      }
    for (const r of m.rooms) {
      const p = pos(r),
        current = r.id === m.roomId;
      const special = r.type === "treasure" || r.type === "shop";
      const color =
        r.type === "boss"
          ? "#c38275"
          : special
            ? "#bea36b"
            : r.visited
              ? "#7b9275"
              : "#39493b";
      content += `<g><title>${ROOM_NAMES[r.type]}${r.visited ? " · 已探索" : ""}</title><rect x="${p.x - 11}" y="${p.y - 8}" width="22" height="16" rx="1" fill="${current ? "#c9b47c" : r.visited ? "#405b48" : "#1c2b22"}" stroke="${current ? "#ffe0a0" : color}" stroke-width="${current ? 2 : 1}"/>${current ? `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#1b3225"/>` : r.type === "boss" ? `<path d="m${p.x - 5} ${p.y - 3} 2 6 h6 l2-6 -4 2 -1-4 -1 4Z" fill="${color}"/>` : special ? `<text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="11" fill="${color}">${r.type === "shop" ? "$" : "◇"}</text>` : r.cleared && r.visited ? `<circle cx="${p.x}" cy="${p.y}" r="2" fill="${color}"/>` : ""}</g>`;
    }
    byId("minimap").innerHTML =
      `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="连通地牢地图，当前房间高亮，Boss 为红色王冠">${content}</svg>`;
  }
}
