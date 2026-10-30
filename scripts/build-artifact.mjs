import fs from "node:fs";
import path from "node:path";

/**
 * Assemble dist-artifact/ into one self-contained page.
 *
 * Run `vite build --config vite.artifact.config.ts` first. Phaser, the game
 * code, the stylesheet and every pixel of art (all generated at runtime) end up
 * inlined, so the result is one file that needs no build step, no server, no
 * asset directory and no network once loaded.
 *
 * Two outputs: artifact.html is a fragment with no doctype, <html>, <head> or
 * <body>, for hosts that supply that skeleton themselves; index.html is the
 * same content wrapped in a standalone document that opens straight from disk.
 */
const dist = "dist-artifact";
const css = fs.readFileSync(path.join(dist, "style.css"), "utf8");
const js = fs.readFileSync(path.join(dist, "ember-vault.js"), "utf8");

for (const [name, source] of [
  ["stylesheet", css],
  ["bundle", js],
]) {
  // A literal closing tag inside the inlined source would end the tag early.
  if (/<\/(script|style)/i.test(source))
    throw new Error(`${name} contains a closing script/style tag`);
}

const fragment = `<title>余烬深牢 · Ember Vault</title>
<style>
${css}
/* Shown only until the game takes over #app. */
.boot {
  display: grid;
  place-content: center;
  gap: 10px;
  min-height: 70vh;
  text-align: center;
  color: #9fae94;
  font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
}
.boot strong {
  font-size: 20px;
  letter-spacing: 0.16em;
  color: #d5b47b;
  font-weight: 500;
}
.boot small { color: #6f7d68; letter-spacing: 0.06em; }
</style>

<div id="app">
  <div class="boot">
    <strong>余烬深牢</strong>
    <span>正在点亮灯火…</span>
    <small>WASD 移动 · 方向键射击 · 空格冲刺</small>
  </div>
</div>

<script>
try {
${js}
} catch (error) {
  document.getElementById("app").innerHTML =
    '<div class="boot"><strong>灯火没能点亮</strong>' +
    '<span>' + String(error && error.message || error) + '</span>' +
    '<small>刷新页面可以再试一次</small></div>';
  throw error;
}
</script>
`;

fs.writeFileSync(path.join(dist, "artifact.html"), fragment);
fs.writeFileSync(
  path.join(dist, "index.html"),
  `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width,initial-scale=1.0" />\n<meta name="theme-color" content="#101917" />\n</head>\n<body style="margin:0">\n${fragment}\n</body>\n</html>\n`,
);
console.log(
  `artifact.html ${(Buffer.byteLength(fragment) / 1024).toFixed(1)} kB (fragment) + standalone index.html`,
);
