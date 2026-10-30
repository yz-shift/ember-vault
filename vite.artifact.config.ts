import { defineConfig } from "vite";

/**
 * Single-file build for hosting the game as one self-contained page.
 *
 * Phaser is bundled in rather than pulled from a CDN, so the page keeps the
 * same promise the local build makes: every asset is generated in code, and
 * once the page has loaded it needs no network at all. Output goes to
 * dist-artifact/ and is assembled into one HTML file by
 * scripts/build-artifact.mjs.
 */
export default defineConfig({
  build: {
    outDir: "dist-artifact",
    emptyOutDir: true,
    cssCodeSplit: false,
    target: "es2020",
    lib: {
      entry: "src/main.ts",
      formats: ["iife"],
      name: "EmberVault",
      fileName: () => "ember-vault.js",
    },
  },
});
