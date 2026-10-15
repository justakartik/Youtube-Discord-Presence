import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "dist");
const pkg = JSON.parse(fs.readFileSync(path.join(here, "package.json"), "utf8"));
const keyFile = path.join(here, "key.json");
if (!fs.existsSync(keyFile)) throw new Error("Run `node scripts/gen-assets.mjs` first (creates key.json and icons).");
const { key } = JSON.parse(fs.readFileSync(keyFile, "utf8"));

fs.rmSync(out, { recursive: true, force: true });
const common = { configFile: false, root: here, logLevel: "warn" };

// 1) UI pages (popup + options), relative asset paths for chrome-extension://
await build({
  ...common,
  base: "./",
  plugins: [react(), tailwind()],
  build: {
    outDir: out, emptyOutDir: false, target: "chrome120", sourcemap: false,
    rollupOptions: { input: { popup: path.join(here, "popup.html"), options: path.join(here, "options.html") } },
  },
  publicDir: path.join(here, "public"),
});

// 2) background service worker (single ES module file) and 3) content script (classic IIFE)
for (const [name, entry, format] of [
  ["background", "src/background/index.ts", "es"],
  ["content", "src/content/index.ts", "iife"],
]) {
  await build({
    ...common,
    publicDir: false,
    build: {
      outDir: out, emptyOutDir: false, target: "chrome120", minify: true,
      lib: { entry: path.join(here, entry), formats: [format], name: "JPresence", fileName: () => `${name}.js` },
    },
  });
}

const manifest = {
  manifest_version: 3,
  name: "Justakartik YouTube Discord Presence",
  short_name: "Justakartik Presence",
  description: "Show what you watch on YouTube and listen to on YouTube Music as your Discord activity.",
  version: pkg.version,
  key,
  minimum_chrome_version: "120",
  icons: { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" },
  action: { default_title: "Justakartik Presence", default_popup: "popup.html", default_icon: { 16: "icons/icon-16.png", 32: "icons/icon-32.png" } },
  options_page: "options.html",
  background: { service_worker: "background.js", type: "module" },
  content_scripts: [
    {
      matches: ["https://www.youtube.com/*", "https://music.youtube.com/*", "https://m.youtube.com/*"],
      js: ["content.js"],
      run_at: "document_idle",
    },
  ],
  permissions: ["storage", "nativeMessaging"],
  host_permissions: ["https://www.youtube.com/*", "https://music.youtube.com/*", "https://m.youtube.com/*"],
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
};
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));

// verify every file referenced by the manifest exists
const refs = [
  manifest.background.service_worker, manifest.options_page, manifest.action.default_popup,
  ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap((c) => c.js),
];
const missing = refs.filter((r) => !fs.existsSync(path.join(out, r)));
if (missing.length) throw new Error("Manifest references missing files: " + missing.join(", "));
console.log("extension built ->", out);
