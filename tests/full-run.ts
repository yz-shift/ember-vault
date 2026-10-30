import { Game } from "../src/game/game.ts";
import { emptyInput } from "../src/game/types.ts";
import { controller } from "./controller.ts";
import fs from "node:fs";
if (process.argv[1]?.endsWith("full-run.ts")) {
  const report = [];
  for (const seed of process.argv.slice(2).length
    ? process.argv.slice(2)
    : ["LANTERN-01", "EMBER-DAWN", "ASH-2026"]) {
    const g = new Game();
    g.reset(seed);
    let input = emptyInput();
    const rooms = [];
    let previous = -1;
    for (let frame = 0; frame < 60 * 60 * 15 && g.mode === "playing"; frame++) {
      if (frame % 5 === 0) input = controller(g);
      g.tick(1 / 60, input);
      g.events = [];
      if (g.roomId !== previous) {
        previous = g.roomId;
        rooms.push({
          id: g.roomId,
          type: g.room.type,
          at: Math.round(g.elapsed),
          hp: g.player.hp,
        });
      }
    }
    const result = {
      seed,
      mode: g.mode,
      seconds: Math.round(g.elapsed),
      hp: g.player.hp,
      kills: g.kills,
      clears: g.clears,
      items: g.player.items,
      rooms,
      final: {
        player: g.player,
        room: g.room,
        inputs: controller(g),
        enemies: g.enemies,
      },
    };
    report.push(result);
    console.log(JSON.stringify(result));
  }
  fs.mkdirSync("output", { recursive: true });
  fs.writeFileSync("output/full-run.json", JSON.stringify(report, null, 2));
}
