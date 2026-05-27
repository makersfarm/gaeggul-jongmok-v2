import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const CACHE_DIR = join(process.cwd(), "data", "cache");

export function cachePath(...parts: string[]) {
  return join(CACHE_DIR, ...parts);
}

export function readJsonCache<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function writeJsonCache(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}
