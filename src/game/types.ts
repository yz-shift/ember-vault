export type RoomType = "spawn" | "battle" | "treasure" | "shop" | "boss";
export type Direction = "north" | "south" | "west" | "east";
export type EnemyKind = "swarm" | "chaser" | "shooter" | "charger" | "ring" | "boss";
export type AimMode = "arrows" | "mouse";
export interface Vec {
  x: number;
  y: number;
}
export interface Rect extends Vec {
  w: number;
  h: number;
}
export interface Pickup extends Vec {
  id: number;
  kind: "coin" | "heart" | "item";
  value: number;
  item?: string;
  price: number;
  collected: boolean;
}
export interface Room extends Vec {
  id: number;
  type: RoomType;
  distance: number;
  doors: Partial<Record<Direction, number>>;
  visited: boolean;
  cleared: boolean;
  rewarded: boolean;
  obstacles: Rect[];
  pickups: Pickup[];
  waves: number;
}
export interface Stats {
  damage: number;
  fireRate: number;
  speed: number;
  pierce: number;
  spread: number;
  bounce: number;
  leech: number;
  frost: number;
  homing: number;
  blast: number;
  maxHp: number;
  magnet: number;
  dashCooldown: number;
  shield: number;
  split: number;
  chain: number;
}
export interface Player extends Vec {
  r: number;
  hp: number;
  coins: number;
  invincible: number;
  dash: number;
  dashCooldown: number;
  fireCooldown: number;
  facing: Vec;
  dashVector: Vec;
  items: Record<string, number>;
  stats: Stats;
  shield: number;
  leechCharge: number;
  hurtRadius: number;
  velocity: Vec;
  moveFacing: Vec;
  firePulse: number;
}
export interface Enemy extends Vec {
  id: number;
  kind: EnemyKind;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  timer: number;
  warning: number;
  action: number;
  aim: Vec;
  vx: number;
  vy: number;
  flash: number;
  slow: number;
  phase: number;
  pattern: number;
  spawnTime: number;
  stagger: number;
  elite: boolean;
  /** Seconds left steering around geometry that blocked the direct approach. */
  detour: number;
}
export interface Bullet extends Vec {
  id: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  friendly: boolean;
  life: number;
  pierce: number;
  bounce: number;
  hit: number[];
  frost: number;
  homing: number;
  blast: number;
  split: number;
  chain: number;
  generation: number;
  splitDone: boolean;
  chainDone: boolean;
  family: { fragments: number; chains: number; blasts: number };
}
export interface CombatEffect extends Vec { kind: "chain" | "blast" | "frost"; toX: number; toY: number; radius: number; life: number; maxLife: number }
export interface Particle extends Vec {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}
export interface Input {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shootX: number;
  shootY: number;
  dash: boolean;
  interact: boolean;
}
export const emptyInput = (): Input => ({
  up: false,
  down: false,
  left: false,
  right: false,
  shootX: 0,
  shootY: 0,
  dash: false,
  interact: false,
});
export const BOUNDS = { left: 64, right: 896, top: 64, bottom: 536 };
export const ROOM_NAMES: Record<RoomType, string> = {
  spawn: "守灯人的避所",
  battle: "遗忘之室",
  treasure: "封存的遗物",
  shop: "无面商人的铺子",
  boss: "空冠圣殿",
};
