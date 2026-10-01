// Simulation smoke test.
//
// The hosting contract says every simulation must open with no console errors
// and make no network request. This checks that in a real browser rather than
// assuming it, and additionally exercises the controls so that a runtime
// error in a rarely-visited panel is caught.
//
// Run:  node build/smoke.mjs

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, dirname, normalize, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ACADEMY = "C:/Users/TalGiladi/OneDrive/repos/tals-academy";

// Playwright lives in the Academy repo's node_modules, not ours.
const require = createRequire(join(ACADEMY, "package.json"));
const { chromium } = await import(pathToFileURL(join(ACADEMY, "node_modules", "playwright", "index.mjs")).href)
  .catch(() => require("playwright"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const TARGETS = [
  { sim: "judge-lab", presets: ["tnr", "threshold", "corrected", "prevalence", "disagreements", "position", "verbosity", "self", "size", "repeats", "validate"] },
  { sim: "tour", presets: [null] },
  { sim: "error-analysis", presets: [null] },
  { sim: "code-checks", presets: [null] },
  { sim: "eval-set", presets: [null] },
  { sim: "rag-evals", presets: [null] },
  { sim: "agent-evals", presets: [null] },
  { sim: "ab-gates", presets: [null] },
  { sim: "device-check", presets: [null] },
];

let failures = 0;

// Playwright's bundled Chromium is not installed here, so drive a browser
// that is. Try the known install paths, then the channel aliases.
const CANDIDATES = [
  ["msedge", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"],
  ["msedge", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"],
  ["chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe"],
  ["chrome", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"],
];
let browser = null;
const launchErrors = [];
for (const [channel, executablePath] of CANDIDATES) {
  try {
    browser = await chromium.launch({ channel, executablePath });
    console.log(`Using ${executablePath}\n`);
    break;
  } catch (e) {
    launchErrors.push(`${executablePath}: ${String(e.message).split("\n")[0]}`);
  }
}
if (!browser) {
  console.log("No browser available for the smoke test.");
  for (const e of launchErrors) console.log("  " + e);
  console.log("Install one with: npx playwright install chromium");
  server.close();
  process.exit(2);
}

for (const target of TARGETS) {
  const page = await browser.newPage();
  const errors = [];
  const offOrigin = [];

  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // The browser always asks for /favicon.ico; a 404 for it is not a
    // property of the simulation.
    if (m.location()?.url?.endsWith("favicon.ico")) return;
    if (m.text().includes("favicon.ico")) return;
    errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("request", (req) => {
    if (!req.url().startsWith(base)) offOrigin.push(req.url());
  });

  for (const preset of target.presets) {
    errors.length = 0;
    const url = `${base}/simulations/${target.sim}/index.html${preset ? `?preset=${preset}` : ""}`;
    try {
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForSelector(".app, .app-head, main", { timeout: 5000 });
      // Exercise the controls: move every slider, cycle every select.
      await page.evaluate(() => {
        for (const r of document.querySelectorAll('input[type="range"]')) {
          r.value = r.max;
          r.dispatchEvent(new Event("input", { bubbles: true }));
          r.value = r.min;
          r.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      await page.waitForTimeout(60);
    } catch (e) {
      errors.push(`navigation/interaction: ${e.message}`);
    }
    const label = preset ? `${target.sim}[${preset}]` : target.sim;
    if (errors.length === 0 && offOrigin.length === 0) {
      console.log(`  ok    ${label}`);
    } else {
      failures++;
      console.log(`  FAIL  ${label}`);
      for (const e of errors.slice(0, 4)) console.log(`          console: ${e}`);
      for (const u of offOrigin.slice(0, 4)) console.log(`          network: ${u}`);
    }
  }
  await page.close();
}

await browser.close();
server.close();

console.log(failures === 0 ? "\nAll simulations load clean.\n" : `\n${failures} simulation check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
