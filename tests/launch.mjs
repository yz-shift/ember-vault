import { chromium } from "playwright";

/**
 * Launch options shared by every browser suite.
 *
 * CHROMIUM_PATH lets a machine that already has a browser on disk (CI images,
 * sandboxes, anywhere `npx playwright install` is not wanted) point at it.
 * Unset, Playwright resolves its own download exactly as before.
 * The SwiftShader flags are required for headless WebGL.
 */
export const launchChromium = (extra = {}) =>
  chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    ...extra,
  });
