import type { Stats } from "./types.ts";
import { TUNING } from "./tuning.ts";
export interface Item {
  id: string;
  name: string;
  effect: string;
  icon: string;
  color: string;
  apply: (s: Stats, n: number) => void;
}
export const ITEMS: Item[] = [
  {
    id: "coal",
    name: "赤烬之心",
    effect: "每层伤害 +3，泪弹更大更有力",
    icon: "◆",
    color: "#e9a16c",
    apply: (s, n) => (s.damage += 3 * n),
  },
  {
    id: "clock",
    name: "急促钟摆",
    effect: "每层射速 +30%，与连锁组合增加传导目标",
    icon: "◷",
    color: "#dbbd81",
    apply: (s, n) => (s.fireRate *= 1 + 0.30 * n),
  },
  {
    id: "boots",
    name: "逐风绑带",
    effect: "每层移速 +12%",
    icon: "»",
    color: "#9bc8aa",
    apply: (s, n) => (s.speed *= 1 + 0.12 * n),
  },
  {
    id: "needle",
    name: "幽影长针",
    effect: "子弹每层额外穿透 1 个敌人",
    icon: "↗",
    color: "#a8d2d4",
    apply: (s, n) => (s.pierce += n),
  },
  {
    id: "prism",
    name: "碎光棱镜",
    effect: "每层增加 2 发散射（最多 7 发），单发保留 90% 伤害",
    icon: "◇",
    color: "#93d3cc",
    apply: (s, n) => {
      s.spread += Math.min(n, 3);
      s.damage *= n > 0 ? .9 : 1;
    },
  },
  {
    id: "mirror",
    name: "回声银镜",
    effect: "子弹每层增加 1 次墙壁与石柱弹射",
    icon: "⬡",
    color: "#adb9e1",
    apply: (s, n) => (s.bounce += n),
  },
  {
    id: "fang",
    name: "渴血獠牙",
    effect: "累计造成 125 点伤害回复 1 生命；叠加缩短阈值",
    icon: "∨",
    color: "#e296a1",
    apply: (s, n) => (s.leech += n),
  },
  {
    id: "frost",
    name: "霜封烛芯",
    effect: "命中减速 30%，每层延长 0.7 秒",
    icon: "❄",
    color: "#9ae0ee",
    apply: (s, n) => (s.frost += n),
  },
  {
    id: "eye",
    name: "寻路之眼",
    effect: "子弹向近处敌人偏转，叠加提高追踪",
    icon: "◉",
    color: "#c1b0de",
    apply: (s, n) => (s.homing += n),
  },
  {
    id: "shell",
    name: "空蝉护符",
    effect: "每次进房获得 1 层护盾；叠加至 3 层",
    icon: "⬟",
    color: "#abcbb1",
    apply: (s, n) => (s.shield += Math.min(n, 3)),
  },
  {
    id: "vessel",
    name: "温热陶罐",
    effect: "每层生命上限 +2，并回复 2 生命",
    icon: "♥",
    color: "#d9989b",
    apply: (s, n) => (s.maxHp += 2 * n),
  },
  {
    id: "magnet",
    name: "贪婪磁石",
    effect: "金币自动吸附范围每层 +90",
    icon: "∩",
    color: "#e4c975",
    apply: (s, n) => (s.magnet += 90 * n),
  },
  {
    id: "feather",
    name: "夜枭残羽",
    effect: "每层冲刺冷却缩短 22%",
    icon: "⌁",
    color: "#c4bad8",
    apply: (s, n) => (s.dashCooldown *= Math.pow(0.78, n)),
  },
  {
    id: "shard",
    name: "裂雨晶核",
    effect: "命中后分裂 3 发泪弹；叠加增加碎片，最多 5 发、仅一代",
    icon: "⋔",
    color: "#a1ddf1",
    apply: (s, n) => (s.split += n),
  },
  {
    id: "conductor",
    name: "鸣雷铜枝",
    effect: "命中向附近 2 个目标连锁；叠加增加传导目标",
    icon: "ϟ",
    color: "#b7c8ff",
    apply: (s, n) => (s.chain += n),
  },
  {
    id: "cinder",
    name: "爆裂火种",
    effect: "命中产生小范围爆炸，叠加扩大范围",
    icon: "✦",
    color: "#eeb378",
    apply: (s, n) => (s.blast += n),
  },
];
/**
 * Relics that visibly change how shots behave. The first two room clears roll
 * from this pool so the build starts forming before the run has a chance to
 * feel flat — a magnet or a heart container is not a combat upgrade.
 */
export const OFFENSIVE_ITEMS = [
  "coal",
  "clock",
  "prism",
  "needle",
  "shard",
  "conductor",
  "cinder",
  "mirror",
];
export const ITEM_BY_ID = Object.fromEntries(
  ITEMS.map((i) => [i.id, i]),
) as Record<string, Item>;
export function getStats(items: Record<string, number>): Stats {
  const s: Stats = {
    damage: TUNING.tear.damage,
    fireRate: TUNING.tear.rate,
    speed: TUNING.player.speed,
    pierce: 0,
    spread: 0,
    bounce: 0,
    leech: 0,
    frost: 0,
    homing: 0,
    blast: 0,
    maxHp: TUNING.player.hp,
    magnet: TUNING.room.magnet,
    dashCooldown: TUNING.player.dashCooldown,
    shield: 0,
    split: 0,
    chain: 0,
  };
  for (const i of ITEMS) if (items[i.id]) i.apply(s, items[i.id]);
  s.fireRate = Math.min(TUNING.tear.maxRate, s.fireRate);
  s.pierce = Math.min(TUNING.tear.maxPierce,s.pierce);
  s.bounce = Math.min(TUNING.tear.maxBounce,s.bounce);
  s.split = Math.min(3,s.split);
  s.chain = Math.min(4,s.chain);
  s.speed = Math.min(330, s.speed);
  s.dashCooldown = Math.max(0.42, s.dashCooldown);
  return s;
}
export const COMBOS = [
  { name: "横扫雨幕", needs: ["prism","needle"], effect: "散射穿透时保留完整伤害；每束追加 2 次穿透，成排击穿敌群" },
  { name: "碎镜暴雨", needs: ["mirror","shard"], effect: "回弹立即分裂，碎片继承 1 次弹射；每颗主弹只分裂一次" },
  { name: "雷鸣织网", needs: ["clock","conductor"], effect: "高频泪弹额外连锁 2 个目标，传导伤害提高到 85%" },
  {
    name: "万花回廊",
    needs: ["prism", "mirror"],
    effect: "散射弹回弹时伤害 +40%",
  },
  {
    name: "霜裂长枪",
    needs: ["needle", "frost"],
    effect: "穿透弹命中冻结敌人，额外释放冰霜冲击",
  },
  {
    name: "血烬引擎",
    needs: ["fang", "cinder"],
    effect: "爆炸伤害参与吸血；击杀使冲刺冷却缩短",
  },
];
export const activeCombos = (items: Record<string, number>) =>
  COMBOS.filter((c) => c.needs.every((id) => items[id] > 0));
