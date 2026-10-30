import Phaser from "phaser";
import { Game } from "./game/game.ts";
import { DungeonScene } from "./render/scene.ts";
import { AudioFX } from "./render/audio.ts";
import { HUD } from "./ui/hud.ts";
import "./style.css";

const model = new Game(),
  audio = new AudioFX(),
  scene = new DungeonScene(model, audio),
  hud = new HUD(model, scene, audio);
scene.onFrame = () => hud.update();
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "phaser-game",
  width: 960,
  height: 600,
  backgroundColor: "#15221c",
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  render: { preserveDrawingBuffer: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [scene],
  audio: { noAudio: true },
  banner: false,
});

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
    __ember?: {
      model: Game;
      scene: DungeonScene;
      start: (seed: string) => void;
    };
  }
}
window.render_game_to_text = () => JSON.stringify(model.snapshot());
window.advanceTime = (ms) => scene.advance(Math.min(60000, Math.max(0, ms)));
// Fixture access is available only on an explicitly requested Vite development URL.
if (
  import.meta.env.DEV &&
  new URLSearchParams(location.search).get("debug") === "1"
)
  window.__ember = { model, scene, start: (seed) => hud.start(seed) };
