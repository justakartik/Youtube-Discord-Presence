import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CompanionConfig } from "./host";

export function configPath(env = process.env): string {
  const base = env.APPDATA || path.join(os.homedir(), ".config");
  return path.join(base, "Justakartik", "Presence", "config.json");
}

const ID = /^\d{15,25}$/;

export function parseConfig(raw: unknown): CompanionConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const ids = (r.clientIds && typeof r.clientIds === "object" ? r.clientIds : {}) as Record<string, unknown>;
  const pick = (v: unknown) => (typeof v === "string" && ID.test(v) ? v : undefined);
  return { clientIds: { youtube: pick(ids.youtube), youtubeMusic: pick(ids.youtubeMusic) } };
}

/** Client IDs baked in at build time (public identifiers); config.json overrides them. */
const BAKED = typeof __DEFAULT_IDS__ !== "undefined" ? __DEFAULT_IDS__ : {};

export function loadConfig(file = configPath()): CompanionConfig {
  let user: CompanionConfig = { clientIds: {} };
  try {
    user = parseConfig(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    /* no config file: use baked defaults */
  }
  return {
    clientIds: {
      youtube: user.clientIds.youtube ?? BAKED.youtube,
      youtubeMusic: user.clientIds.youtubeMusic ?? BAKED.youtubeMusic,
    },
  };
}
