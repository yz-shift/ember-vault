import { Random } from "./random.ts";
import type { Direction, Room } from "./types.ts";
export const DIRECTIONS: {
  name: Direction;
  opposite: Direction;
  x: number;
  y: number;
}[] = [
  { name: "north", opposite: "south", x: 0, y: -1 },
  { name: "south", opposite: "north", x: 0, y: 1 },
  { name: "west", opposite: "east", x: -1, y: 0 },
  { name: "east", opposite: "west", x: 1, y: 0 },
];
export function generateMap(seed: string): Room[] {
  const rng = new Random(seed + ":map");
  const rooms: Room[] = [];
  const add = (x: number, y: number, parent?: Room) => {
    const r: Room = {
      id: rooms.length,
      x,
      y,
      type: "battle",
      distance: parent ? parent.distance + 1 : 0,
      doors: {},
      visited: false,
      cleared: false,
      rewarded: false,
      obstacles: [],
      pickups: [],
      waves: 0,
    };
    rooms.push(r);
    if (parent) {
      const dir = DIRECTIONS.find(
        (d) => parent.x + d.x === x && parent.y + d.y === y,
      )!;
      parent.doors[dir.name] = r.id;
      r.doors[dir.opposite] = parent.id;
    }
    return r;
  };
  add(0, 0);
  // A guaranteed long branch, then a randomized tree; every door is bidirectional.
  let tail = rooms[0];
  const first = rng.pick(DIRECTIONS);
  for (let i = 0; i < 4; i++)
    tail = add(tail.x + first.x, tail.y + first.y, tail);
  const count = rng.int(10, 15);
  while (rooms.length < count) {
    const options = rooms
      .flatMap((r) =>
        DIRECTIONS.map((d) => ({ parent: r, x: r.x + d.x, y: r.y + d.y })),
      )
      .filter(
        (p) =>
          !rooms.some((r) => r.x === p.x && r.y === p.y) &&
          rooms.filter((r) => Math.abs(r.x - p.x) + Math.abs(r.y - p.y) === 1)
            .length === 1,
      );
    const p = rng.pick(options);
    add(p.x, p.y, p.parent);
  }
  rooms[0].type = "spawn";
  rooms[0].cleared = true;
  rooms[0].rewarded = true;
  const sorted = rooms.slice(1).sort((a, b) => b.distance - a.distance);
  sorted[0].type = "boss";
  const early = rooms.filter((r) => r.type === "battle" && r.distance <= 2);
  rng.pick(early).type = "treasure";
  rng.pick(rooms.filter((r) => r.type === "battle")).type = "treasure";
  rng.pick(rooms.filter((r) => r.type === "battle" && r.distance <= 4)).type =
    "shop";
  for (const r of rooms) {
    if (r.type === "battle" && rng.next() > 0.22) {
      // Isolated pillars leave central axes and every entrance clear.
      const positions = [
        { x: 280, y: 170 },
        { x: 636, y: 386 },
        { x: 280, y: 386 },
        { x: 636, y: 170 },
      ];
      r.obstacles = positions
        .slice(0, rng.int(1, 3))
        .map((p) => ({ ...p, w: 44, h: 44 }));
    }
    if (r.type === "treasure" || r.type === "shop") r.cleared = true;
  }
  return rooms;
}
