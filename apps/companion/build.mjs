import { build } from "esbuild";
import fs from "node:fs";

fs.mkdirSync("dist", { recursive: true });
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/host.cjs",
  minify: false,
  legalComments: "none",
});
console.log("companion bundled -> dist/host.cjs");
