# Ember Vault (余烬深牢)

> 中文版：[README.zh-CN.md](README.zh-CN.md)

An original single-player top-down dungeon roguelike, built with TypeScript, Phaser 3.90 and Vite. Characters, pixel textures, dungeon decorations, the interface and sound effects are all generated in code, with no downloaded art, paid assets or API keys. The in-game text is in Chinese.

## Running it

Requires Node.js **22.18+** (developed with 24.14). In this folder, run:

```powershell
npm.cmd install
npm.cmd run dev
```

Open **http://127.0.0.1:5180/**. On macOS or Linux, use `npm` instead of `npm.cmd`.

```powershell
npm.cmd run build
npm.cmd run preview
```

The production preview runs at http://127.0.0.1:4180/, and the build output goes to `dist/`. All assets are served from the same site, so once dependencies are installed it runs without a network connection. It is a standalone project and does not depend on code from any other project.

## Controls and goal

| Key | Action |
| --- | --- |
| WASD | Move in eight directions, with diagonal speed normalised; reaches full speed in about 0.07 s and stops about 0.06 s after release |
| ↑ ↓ ← → | Shoot in four directions; hold to keep firing |
| Left mouse button | Optional aiming mode: move with WASD, aim with the mouse, hold the left button to shoot |
| Space | Dash in the movement direction, or in the shooting direction when standing still; brief invincibility |
| E | Buy a shop item when standing next to it; the price is shown below the item |
| Esc | Pause / resume; the game also pauses when the window loses focus |
| F | Toggle fullscreen |
| M | Toggle synthesised sound effects |

The **✛ / ⌖** button in the top bar switches between arrow-key aiming and mouse aiming, and the choice is saved in `localStorage`. Movement, facing and shooting direction are independent: firing and turning never interrupt movement, and the shooting direction can change at any time while moving. The player's hurt radius (7.5) is smaller than the collision radius (10), so a shot that only grazes the edge counts as a dodge.

Walk into an open door to move to the next room. Free drops are picked up automatically when you get close, and coins are pulled towards you. Combat rooms have 2–4 waves of guards (more in deeper rooms). Defeating them all opens the doors and grants a one-time reward of coins, supplies or a relic, and **the first two room clears always drop a relic that changes how you attack**. With **3 Seals (守印)** you can enter the Hollow Crown Sanctum (空冠圣殿) in the farthest room. When the boss enters its second phase, it clears its old bullets and attacks more often.

## Features

- Random connected maps of 10–15 rooms: a safe spawn room, combat rooms, two treasure rooms, a shop, and a boss room at the farthest leaf node. Every door connects both ways, and pillars never block a path.
- Each room's exploration, clear, reward and shop state is kept for the whole run. Changing rooms clears bullets, enemies and visual objects, and restarting creates a fresh run state.
- Five enemy types: **swarms of fragile small enemies** (one basic tear shot kills them) mixed with chasers that pounce, ranged fan shooters, directional chargers and ring-bullet casters. Every attack is telegraphed, and so is every spawn: enemies first appear as a marker, cannot take or deal damage while marked, and never spawn next to the player.
- Deeper rooms only add **more enemies**, never more health per enemy. Elites only change behaviour and attack patterns, and have the same health as normal enemies of their type.
- A two-phase boss with gapped ring shots, aimed fan shots and telegraphed charges; below half health it attacks faster and denser. After a win or a loss, you can restart straight away with the same seed or a new one.
- 16 stackable relics: damage, fire rate, move speed, pierce, spread, bounce, split, chain, explosion, lifesteal, frost, homing, shield, max health, coin magnet and dash cooldown. Split, chain and explosion each have their own visuals, not just stat changes.
- Six combos: **Sweeping Rain (横扫雨幕)** (spread + pierce), **Shattered Mirror Storm (碎镜暴雨)** (bounce + split), **Thunder Web (雷鸣织网)** (fire rate + chain), **Kaleidoscope Gallery (万花回廊)** (spread + bounce), **Frostsplit Lance (霜裂长枪)** (pierce + frost) and **Blood Ember Engine (血烬引擎)** (lifesteal + explosion). Split only goes one generation, and chain and explosion have a budget per fired bullet, so however dense the build gets they never trigger without limit.
- A minimap, health, coins, Seals, a timer, current stats, relic count and descriptions, combo hints and a full compendium. When you hold many items, the right-hand panel scrolls on its own.
- Procedural pixel characters, stone bricks, lamps, pillars, a merchant and opening chests. **Teardrop-shaped projectiles**: the round head faces the direction of travel and the tail narrows, and higher damage makes them bigger. Hits flash white, knock enemies back and burst into short shard particles; chain lightning, explosions and frost impacts are all drawn. Normal hits do not shake the screen; only kills and explosions do, with a cooldown, so the screen does not keep shaking while you mow down crowds.

## Seeds and modules

The start screen accepts a seed of up to 40 characters, and `⟳` generates a random one; the default seed is `LANTERN-01`. The same seed always generates the same map, and the same exploration order and inputs also reproduce item results and combat. The reward RNG is separate from visual randomness, so screenshots and drawing never affect drops.

```text
src/game/tuning.ts   Every feel and progression number: acceleration, fire rate and bullet speed,
                     enemy health, wave size, item caps, feedback cooldowns. Tuning only touches this file.
src/game/random.ts   Reproducible random numbers
src/game/map.ts      Connected map and room layout
src/game/items.ts    16 relics, stacked stats and six combos
src/game/enemies.ts  Enemy state machines, obstacle avoidance and boss attacks
src/game/combat.ts   Projectiles, collision, damage, split / chain / explosion
src/game/physics.ts  Stepped movement and shortest-direction collision resolution
src/game/game.ts     Run state, waves, rewards, purchases, room changes, restarts
src/render/art.ts   Procedural pixel textures and dungeon backgrounds
src/render/scene.ts Phaser scene, keyboard / mouse input, drawing and feedback
src/render/audio.ts Web Audio synthesised sound effects
src/ui/hud.ts       Page HUD, map, menus and compendium
```

Textures use Phaser's [Canvas Texture / Texture API](https://docs.phaser.io/phaser/concepts/textures). Rendering uses a single Phaser canvas, and the page HUD updates separately.

## Testing

```powershell
npm.cmd test
# The browser tests below need npm.cmd run dev running in another terminal
# If this machine has no Playwright browser yet, first run npx playwright install chromium
npm.cmd run test:browser
npm.cmd run test:full
npm.cmd run test:full:browser
# The production smoke test needs npm.cmd run preview running in another terminal
npm.cmd run test:production
```

If Chromium is already installed and you do not want Playwright to download another copy, set `CHROMIUM_PATH` to its executable. When it is not set, nothing changes.

- **Core tests (`tests/core.test.ts`, 11 tests)**: map size, connectivity, two-way doors and the farthest boss room across 1000 seeds; movement and dash collision, telegraphs for all five enemy types, wave clearing, one-time rewards, shop transactions, relic stacking and every combo, pierce / bounce / lifesteal, the two-phase boss, pausing, invincibility after a hit, and restart state.
- **Feel tests (`tests/feel.test.ts`, 12 tests)**: reaches full speed within 0.09 s, and stops immediately on release with no drift; diagonal speed stays normalised **while accelerating**, not just at full speed; holding a fire key keeps firing at the set rate, and releasing it does not bank shots; shooting never affects movement in any way; bullets inherit movement speed but stray from the aim by < 0.13 rad; sliding along walls without building up speed on the blocked axis; every spawn is telegraphed, away from the player, and harmless both ways during the telegraph; small enemies die in one shot and gain no health with depth; after upgrades, damage output over the same time is > 2.5×; dense builds stay within the bullet and split budgets; **no getting stuck on corners**; being killed in a dense barrage does not crash the tick.
- **Browser interaction (`tests/browser.mjs`, 23 tests)**: actually clicking Start; keyboard movement, four-way shooting, dash and Esc pause; **firing continuously while holding a fire key and moving diagonally**; **mouse aiming fires towards the cursor and stops on release**; walking through doors and picking things up; spawn telegraphs and spawn distance; real bullet hits opening the doors; leaving a cleared room and coming back without a repeat reward; buying with E; combos, the compendium and boss phases; **bullet budget and throughput for dense builds**; bullets causing a win and a death, then clicking to restart; no page overflow at desktop sizes. Edge cases such as the shop, combos, the boss and death use a development-only fixture to set up the starting state, then make their assertions through real in-game collisions and input.
- **A full normal run**: in the browser, the regular `Input` controller plays the default seed without changing health, damage, enemies or room state. Result: **13/13 rooms** explored, **8 combat rooms** cleared, **266 enemies (including the boss)** defeated, and the run won in **250.2 s** at full health (8/8). That is **1.06 kills/s**.
- **A simulated batch of 12 seeds** (same controller, simulation only, no rendering): 12/12 runs won in 118–250 s at 0.95–1.92 kills/s, and no run went more than 120 s without a kill.
- Screenshots were checked by eye, with no console errors or page errors in the browser. Sizes checked: 1024×768, 1280×720, 1440×900, 1920×1080.
- The production build was also checked live in a browser: with a real clock, movement, shooting and pause/resume work, and the development test hooks stay hidden even when the URL contains `?debug=1`. Evidence: `output/production/report.json`.
- `output/browser/` holds the interaction screenshots and report, and `output/full-browser/report.json` holds the evidence for the full run. The `output/` folder is generated by the tests and is not committed.

`window.render_game_to_text()` returns a readable state, and `window.advanceTime(ms)` switches to deterministic manual stepping; reloading the page returns to real time. The fixture hooks are only exposed in Vite development mode with `?debug=1` in the URL, never in production builds.

## Current limitations

- A single dungeon floor, single player only, with no mid-run saving and no touch or gamepad support. Mouse aiming is an optional mode, not a touch solution.
- **Runs are much shorter than before the feel rework**: the controller's winning run dropped from 464.5 s to 250.2 s, while kills rose from 78 to 266 (kill rate 0.17 → 1.06 per second). This comes directly from clearing enemies faster, not from less content. To bring runs back to 5–10 minutes, change the tiers of `r.waves` in `src/game/game.ts` or the scale factor in `TUNING.waves`; do not go back to adding enemy health.
- All run times and kill rates above come from the **automated controller**, not human players. Real players will be slower because they explore, read relics, hesitate and die. Difficulty balance has not been tested by people.
- The feel numbers (acceleration and deceleration times, fire rate, bullet speed, inherited speed ratio, screen-shake cooldown) are asserted against the running code, but there is no human playtest data on whether the game is fun.
- The synthesised sound path has been verified in a browser but not judged by human listeners, and visual and input checks were done mainly in Chromium.
- Headless software rendering in a container only runs rAF at about 30 fps, so the production smoke test **waits for real-time progress** instead of assuming progress from wall-clock time. This does not verify 60 fps.
