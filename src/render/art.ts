import Phaser from "phaser";
import { Random } from "../game/random.ts";
import type { Room } from "../game/types.ts";

const sprites: Record<string, string[]> = {
  player: [
    "        4444        ",
    "      44333344      ",
    "     4333333334     ",
    "    433333333334    ",
    "   43335555553334   ",
    "   43355000553334   ",
    "   43350660553334   ",
    "   43350000553334   ",
    "    43557755334     ",
    "     435555334      ",
    "    88333333388     ",
    "   8333333333338    ",
    "  833343333433338   ",
    "  832343333432338   ",
    "  832243333422338   ",
    "   8222444422228    ",
    "    82222222228     ",
    "    82222222228     ",
    "     882222288      ",
    "      998899        ",
    "     999  999       ",
    "     999  999       ",
  ],
  // Swarm: a small drifting husk. Deliberately reads as fragile at a glance so
  // a crowd of them looks like something to cut through, not something to fear.
  swarm: [
    "    22222    ",
    "   2333332   ",
    "  233333332  ",
    " 23341114332 ",
    " 23415154332 ",
    " 23341114332 ",
    "  233333332  ",
    "   23333332  ",
    "  2 333332 2 ",
    " 2   2 2   2 ",
    "      2      ",
  ],
  chaser: [
    "     22      22     ",
    "     232    232     ",
    "      23222232      ",
    "     2333333332     ",
    "    233333333332    ",
    "   23344114433332   ",
    "   23455115543332   ",
    "   23344114433332   ",
    "    233333333332    ",
    "     2331113332     ",
    "    223355533322    ",
    "   23333333333332   ",
    "  2333233333323332  ",
    "  2322333333332232  ",
    "   2 233333332 2    ",
    "     233223332      ",
    "    2222  2222      ",
  ],
  shooter: [
    "        666        ",
    "       62226       ",
    "      6222226      ",
    "     622222226     ",
    "    62222222226    ",
    "    62211112226    ",
    "    62155411226    ",
    "    62211112226    ",
    "     622222226     ",
    "      6222226      ",
    "    7722222277     ",
    "   722222222227    ",
    "  72222777222227   ",
    "   727777777727    ",
    "    7777777777     ",
    "    2777777772     ",
    "     27777772      ",
    "    22      22     ",
  ],
  charger: [
    "  66            66  ",
    "   656        656   ",
    "   65566666666556   ",
    "    655555555556    ",
    "   65522222222556   ",
    "  6522222222222256  ",
    "  6222332233222226  ",
    "  6222442244222226  ",
    "  6222332233222226  ",
    "   62222222222226   ",
    "  7762225552222677  ",
    " 722622222222226227 ",
    " 722622222222226227 ",
    "  7722222222222277  ",
    "    222222222222    ",
    "    22222  22222    ",
    "    7777    7777    ",
  ],
  ring: [
    "         6         ",
    "       66566       ",
    "      6555556      ",
    "     655333556     ",
    "   6655333335566   ",
    "  655331113335556  ",
    " 65533155413335556 ",
    "6555331554133355556",
    " 6553311133355556  ",
    "  65533333335556   ",
    "   66553335566     ",
    "     6555556       ",
    "      65556        ",
    "     66 6 66       ",
    "    66  6  66      ",
  ],
  boss: [
    "    66       66       66    ",
    "    656     6556     656    ",
    "    6556   655556   6556    ",
    "    6555666655556666556    ",
    "     65555555555555556     ",
    "     66666666666666666     ",
    "    6222222222222222226    ",
    "   622222222222222222226   ",
    "   622233333223333322226   ",
    "   622234443223444322226   ",
    "   622233333223333322226   ",
    "    6222222222222222226    ",
    "     62222111111222226     ",
    "      622225555222226      ",
    "   77762222222222226777    ",
    "  733377222222222773337   ",
    " 73333337777777773333337  ",
    "7333333333222233333333337 ",
    "7333333332222223333333337 ",
    " 73333333222222333333337  ",
    "  733333322222223333337   ",
    "   733333222222333337    ",
    "   733333322223333337    ",
    "    7333333223333337     ",
    "     73333333333337      ",
    "     77333333333377      ",
    "      777 7777 777       ",
  ],
};
const palettes: Record<string, Record<string, string>> = {
  player: {
    "0": "#101c1c",
    "2": "#304d46",
    "3": "#518474",
    "4": "#81b5a0",
    "5": "#20342f",
    "6": "#f5deb1",
    "7": "#ccaa74",
    "8": "#182b2b",
    "9": "#152322",
  },
  // Deliberately violet: the room, the player and their tears are all teal-green,
  // so the crowd has to sit off that axis to stay readable in a mass of them.
  swarm: {
    "1": "#191522",
    "2": "#463453",
    "3": "#9c85b0",
    "4": "#271d31",
    "5": "#f6cf83",
  },
  chaser: {
    "1": "#241e24",
    "2": "#384947",
    "3": "#6d9284",
    "4": "#2e302b",
    "5": "#f7c57b",
  },
  shooter: {
    "1": "#211b21",
    "2": "#78516d",
    "4": "#ffecb1",
    "5": "#f18c79",
    "6": "#b27c99",
    "7": "#3d384b",
  },
  charger: {
    "2": "#775653",
    "3": "#382c2e",
    "4": "#ffba7f",
    "5": "#bb9679",
    "6": "#d2ba94",
    "7": "#3d3034",
  },
  ring: {
    "1": "#3f2e32",
    "3": "#8c604d",
    "4": "#fff1b6",
    "5": "#d59d62",
    "6": "#634e42",
  },
  boss: {
    "1": "#261e27",
    "2": "#786a71",
    "3": "#433e53",
    "4": "#ffe6b2",
    "5": "#c9a36b",
    "6": "#d8bf8f",
    "7": "#242a39",
  },
};
export function createArt(scene: Phaser.Scene) {
  for (const [key, rows] of Object.entries(sprites)) {
    const w = Math.max(...rows.map((r) => r.length)),
      h = rows.length;
    const t = scene.textures.createCanvas(key, w, h)!;
    const c = t.context;
    rows.forEach((row, y) =>
      [...row].forEach((v, x) => {
        if (palettes[key][v]) {
          c.fillStyle = palettes[key][v];
          c.fillRect(x, y, 1, 1);
        }
      }),
    );
    t.refresh();
  }
  const glow = scene.textures.createCanvas("glow", 128, 128)!;
  const c = glow.context;
  const grad = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(129,195,162,.32)");
  grad.addColorStop(0.35, "rgba(129,195,162,.10)");
  grad.addColorStop(1, "rgba(129,195,162,0)");
  c.fillStyle = grad;
  c.fillRect(0, 0, 128, 128);
  glow.refresh();
}

export function paintRoom(scene: Phaser.Scene, room: Room, seed: string) {
  const key = "floor";
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, 960, 600)!;
  const c = t.context;
  const rng = new Random(seed + ":art:" + room.id);
  c.fillStyle = "#101917";
  c.fillRect(0, 0, 960, 600);
  c.fillStyle = "#121d1b";
  c.fillRect(38, 34, 884, 532);
  // Hand laid stone: staggered joints, recessed seams, worn corners.
  for (let y = 48; y < 554; y += 32)
    for (let x = 48 - (y % 64 ? 16 : 0); x < 920; x += 48) {
      const tint = rng.int(0, 9);
      c.fillStyle = `rgb(${30 + tint},${43 + tint},${39 + tint})`;
      c.fillRect(x + 1, y + 1, 46, 30);
      c.fillStyle = "rgba(133,157,129,.06)";
      c.fillRect(x + 2, y + 1, 44, 1);
      if (rng.next() < 0.18) {
        c.fillStyle = "#1a2824";
        c.fillRect(x + 12, y + 10, 12, 1);
        c.fillRect(x + 23, y + 10, 1, 5);
      }
    }
  c.strokeStyle = "#566348";
  c.globalAlpha = 0.22;
  c.lineWidth = 2;
  c.strokeRect(91, 89, 778, 422);
  c.strokeRect(99, 97, 762, 406);
  c.globalAlpha = 1;
  // The engraved hearth emblem beneath the combat space.
  c.save();
  c.translate(480, 300);
  c.strokeStyle = room.type === "boss" ? "#6d5449" : "#637057";
  c.globalAlpha = 0.18;
  c.lineWidth = 2;
  for (const r of [92, 101, 127]) {
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    c.beginPath();
    c.moveTo(Math.cos(a) * 105, Math.sin(a) * 105);
    c.lineTo(Math.cos(a) * 121, Math.sin(a) * 121);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(0, -74);
  c.lineTo(45, 12);
  c.lineTo(0, 68);
  c.lineTo(-45, 12);
  c.closePath();
  c.stroke();
  c.beginPath();
  c.moveTo(0, -34);
  c.lineTo(18, 15);
  c.lineTo(0, 38);
  c.lineTo(-18, 15);
  c.closePath();
  c.stroke();
  c.restore();
  // Raised perimeter stones and a long inner wall shadow.
  c.fillStyle = "rgba(2,10,9,.30)";
  c.fillRect(64, 64, 832, 16);
  c.fillRect(64, 64, 15, 472);
  c.fillRect(880, 64, 16, 472);
  for (let x = 32; x < 928; x += 48) {
    for (const y of [22, 542]) {
      c.fillStyle = "#172420";
      c.fillRect(x, y, 47, 36);
      c.fillStyle = "#3d4d3e";
      c.fillRect(x + 2, y, 44, 6);
      c.fillStyle = "#263a30";
      c.fillRect(x + 2, y + 7, 44, 23);
      c.fillStyle = "#45533d";
      c.fillRect(x + 4, y + 8, 40, 2);
    }
  }
  for (let y = 58; y < 542; y += 48) {
    for (const x of [24, 900]) {
      c.fillStyle = "#172420";
      c.fillRect(x, y, 36, 47);
      c.fillStyle = "#3d4d3e";
      c.fillRect(x + 3, y + 2, 30, 5);
      c.fillStyle = "#283a30";
      c.fillRect(x + 3, y + 8, 30, 36);
    }
  }
  for (const o of room.obstacles) {
    c.fillStyle = "rgba(5,11,10,.45)";
    c.fillRect(o.x + 5, o.y + 7, o.w + 8, o.h + 9);
    c.fillStyle = "#17211c";
    c.fillRect(o.x - 2, o.y - 2, o.w + 4, o.h + 4);
    c.fillStyle = "#405345";
    c.fillRect(o.x, o.y - 8, o.w, o.h + 8);
    c.fillStyle = "#60715a";
    c.fillRect(o.x + 3, o.y - 8, o.w - 6, 9);
    c.fillStyle = "#758166";
    c.fillRect(o.x + 5, o.y - 8, o.w - 10, 2);
    c.fillStyle = "#314333";
    c.fillRect(o.x + 5, o.y + 6, o.w - 10, o.h - 8);
    c.fillStyle = "#51604a";
    c.fillRect(o.x + 8, o.y + 9, 3, o.h - 14);
    c.fillRect(o.x + o.w - 11, o.y + 9, 3, o.h - 14);
  }
  // Pebbles and tiny original bones, confined to the edge of the floor.
  for (let i = 0; i < 95; i++) {
    const x = rng.int(90, 865),
      y = rng.pick([rng.int(83, 122), rng.int(478, 518)]);
    if (Math.abs(x - 480) < 58) continue;
    c.fillStyle = rng.pick(["#3d4b3d", "#435040", "#182720"]);
    c.fillRect(x, y, rng.int(2, 5), 2);
  }
  for (const [x, y] of [
    [125, 132],
    [828, 469],
    [161, 459],
  ]) {
    c.fillStyle = "#71806a";
    c.fillRect(x, y, 8, 5);
    c.fillRect(x + 1, y + 4, 6, 3);
    c.fillStyle = "#263b2d";
    c.fillRect(x + 1, y + 1, 2, 2);
    c.fillRect(x + 5, y + 1, 2, 2);
    c.fillStyle = "#657660";
    c.fillRect(x + 12, y + 7, 12, 2);
  }
  const vignette = c.createRadialGradient(480, 300, 150, 480, 300, 550);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(1,8,6,.46)");
  c.fillStyle = vignette;
  c.fillRect(0, 0, 960, 600);
  t.refresh();
  return key;
}
