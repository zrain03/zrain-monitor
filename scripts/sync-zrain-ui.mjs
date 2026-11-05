/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-05
 * Fail / File: scripts/sync-zrain-ui.mjs
 * BM: Skrip operasi, konfigurasi atau deployment Monitor.
 * EN: Monitor operations, configuration or deployment script.
 */
// BM: Salin aset rasmi yang dipin; CRLF dan LF dianggap setara untuk JS/CSS sahaja.
// EN: Mirror pinned official assets; treat CRLF and LF as equivalent only for JS/CSS.

import {readFile, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const publicDir = pkg.zrainUi?.publicDir;
if (typeof publicDir !== "string" || !publicDir || path.isAbsolute(publicDir) ||
    publicDir.split(/[\\/]/).includes("..")) {
  throw new Error("Configure a safe relative zrainUi.publicDir in package.json.");
}
const src = path.join(root, "node_modules", "@zrain", "ui");
const target = path.resolve(root, publicDir);
const files = [
  ["src/brand.css", "brand.css"],
  ["src/zrain-ui.js", "zrain-ui.js"],
  ["assets/zrain-logo.webp", "zrain-logo.webp"]
];
// BM: Normalisasikan line ending teks untuk mengelakkan perbezaan checkout Windows.
// EN: Normalize text line endings to avoid Windows checkout differences.
// Logo binari kekal dibandingkan byte demi byte.
// Binary logo comparisons remain byte-for-byte strict.
const normalize = (buffer, name) =>
  /\.(?:css|js)$/.test(name)
    ? Buffer.from(buffer.toString("utf8").replace(/\r\n/g, "\n"), "utf8")
    : buffer;
const check = process.argv.includes("--check");
let changed = 0;
for (const [from, name] of files) {
  let expected;
  try { expected = await readFile(path.join(src, from)); }
  catch { throw new Error("Missing official Zrain UI package. Run npm install first."); }
  const file = path.join(target, name);
  const actual = await readFile(file).catch(error => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (!actual || !normalize(expected, name).equals(normalize(actual, name))) {
    changed++;
    if (check) console.error(`Out of sync: ${name}`);
    else {
      await writeFile(file, normalize(expected, name));
      console.log(`Synced official Zrain UI: ${name}`);
    }
  }
}
if (check && changed) {
  console.error("Run npm run ui:sync, then npm run test:release.");
  process.exitCode = 1;
} else console.log(check ? "Shared Zrain UI is up to date." : `Synced ${changed} asset(s).`);
