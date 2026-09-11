import { gzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = new URL("../dist/", import.meta.url);
const files = await readdir(root, { recursive: true });
const names = files.map(String);

const forbidden = ["catalog.sample", "__fixtures", "Future API", "Metrics", "Media Server", "Home Assistant"];
const textFiles = names.filter((name) => /\.(?:html|js|css|json|webmanifest)$/.test(name) && !name.endsWith(".map"));
const text = (await Promise.all(textFiles.map((name) => readFile(new URL(name, root), "utf8")))).join("\n");
for (const token of forbidden) {
  if (text.includes(token)) throw new Error(`production output contains forbidden fixture token: ${token}`);
}

const required = [
  "manifest.json",
  "sw.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png"
];
for (const name of required) {
  if (!names.includes(name)) throw new Error(`production output is missing ${name}`);
  if ((await stat(new URL(name, root))).size === 0) throw new Error(`${name} is empty`);
}

const javascript = textFiles.filter((name) => name.endsWith(".js") && name.startsWith("assets/"));
const compressedBytes = (await Promise.all(javascript.map(async (name) => gzipSync(await readFile(new URL(name, root))).byteLength)))
  .reduce((total, bytes) => total + bytes, 0);
const budgetBytes = 180 * 1024;
if (compressedBytes > budgetBytes) {
  throw new Error(`initial JavaScript is ${(compressedBytes / 1024).toFixed(1)} KiB gzip, over the 180 KiB budget`);
}

console.log(`PASS dist verification: ${(compressedBytes / 1024).toFixed(1)} KiB initial JS gzip, no fixtures, PWA assets present`);
