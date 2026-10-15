import { build } from "esbuild";
import fs from "node:fs";

const { id } = JSON.parse(fs.readFileSync("../extension/key.json", "utf8"));
const defaults = JSON.parse(fs.readFileSync("default-config.json", "utf8")).clientIds;

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
  define: { __EXT_ID__: JSON.stringify(id), __DEFAULT_IDS__: JSON.stringify(defaults) },
});
console.log("companion bundled -> dist/host.cjs");
