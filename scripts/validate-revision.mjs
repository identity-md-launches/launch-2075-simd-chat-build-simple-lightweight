import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

// Reproduce the reported defects on dist/, then rerun unchanged checks after fixes.
const baseline = process.argv.includes("--baseline");
const dependencyRoot = process.env.NYIMAK_NODE_MODULES;
const { chromium } = await import(
  dependencyRoot
    ? pathToFileURL(`${dependencyRoot}/playwright/index.mjs`).href
    : "playwright"
);
const root = resolve("dist");
const out = resolve("artifacts");
await mkdir(out, { recursive: true });
const mime = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png",
};
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = resolve(root, path.slice("/preview/".length) || "index.html");
    if (!path.startsWith("/preview/") || !file.startsWith(root + sep)) {
      res.writeHead(404).end();
      return;
    }
    if (!(await stat(file)).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = { baseline, date: new Date().toISOString(), checks: [] };
const record = (name, passed, evidence) => {
  results.checks.push({ name, passed, evidence });
  console.log(`${passed ? "PASS" : baseline ? "REPRODUCED" : "FAIL"} ${name}: ${JSON.stringify(evidence)}`);
};
const now = Date.now();
const post = (id, symbol, author, ageHours = 1, likes = 10, reposts = 2) => ({
  id, text: `meme $${symbol} ${id}`, author,
  createdAt: new Date(now - ageHours * 3_600_000).toISOString(), likes, reposts,
});
let browser;
try {
  browser = await chromium.launch({ headless: true });
  results.browser = `Chromium ${browser.version()}`;
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(6000);
  await page.clock.install({ time: new Date(now) });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(url) && response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(url);
  await page.locator(".coin-row").first().waitFor();

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const snapshot = await page.locator(".coin-row").first().ariaSnapshot();
    const units = await page.locator(".mentions-metric strong span").evaluateAll((items) => items.map((el) => ({
      text: el.textContent, display: getComputedStyle(el).display,
    })));
    record(`Accessible post units at ${width}`, /32 post/.test(snapshot) && units.every((u) => u.display !== "none"), { snapshot, units });
  }

  let payload = { posts: [post("wide", "WWWWWWWWWWWW", "pengamat")] };
  let requests = 0;
  await page.route("https://feed.nyimak.test/revision", async (route) => {
    requests++;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
  await page.getByRole("button", { name: "Sumber data", exact: true }).click();
  await page.getByRole("textbox", { name: "URL feed publik" }).fill("https://feed.nyimak.test/revision");
  await page.getByRole("button", { name: "Hubungkan feed", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });

  for (const [width, height] of [[320, 700], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.getByRole("button", { name: "Lihat detail WWWWWWWWWWWW", exact: true }).click();
    const geometry = await page.locator("dialog").evaluate((dialog) => {
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      return {
        clientWidth: dialog.clientWidth, scrollWidth: dialog.scrollWidth,
        dialog: box(dialog), close: box(dialog.querySelector(".dialog-heading button")),
        save: box(dialog.querySelector(".coin-detail-header button")),
        heading: box(dialog.querySelector("h2")), name: box(dialog.querySelector("h3")),
        headingText: dialog.querySelector("h2").textContent, nameText: dialog.querySelector("h3").textContent,
        fontSizes: ["h2", "h3"].map((sel) => getComputedStyle(dialog.querySelector(sel)).fontSize),
      };
    });
    record(`Complete ticker and usable controls at ${width}`, geometry.scrollWidth <= geometry.clientWidth
      && [geometry.close, geometry.save, geometry.heading, geometry.name].every((r) => r.left >= geometry.dialog.left && r.right <= geometry.dialog.right && r.right <= width)
      && geometry.headingText === "Percakapan $WWWWWWWWWWWW" && geometry.nameText === "WWWWWWWWWWWW", geometry);
    await page.screenshot({ path: resolve(out, `${baseline ? "before" : "after"}-dialog-${width}.png`) });
    if (!baseline) {
      await page.getByRole("dialog").getByRole("button", { name: "Simpan WWWWWWWWWWWW", exact: true }).click();
      assert.equal(await page.locator("dialog .save-button").getAttribute("aria-pressed"), "true");
      await page.locator("dialog .save-button").click();
      await page.getByRole("button", { name: "Tutup dialog", exact: true }).click();
    } else {
      await page.keyboard.press("Escape");
    }
  }

  async function refreshVisible() {
    const before = requests;
    const response = page.waitForResponse("https://feed.nyimak.test/revision");
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await response;
    await page.waitForFunction(() => document.querySelector(".coin-list")?.getAttribute("aria-busy") === "false");
    assert.ok(requests > before, "Returning to a visible tab requests the feed");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  payload = { posts: [post("p1", "PEPE", "pengamat"), post("p2", "PEPE", "@pengamat", 0, 20, 3)] };
  await refreshVisible();
  await page.getByRole("button", { name: "Lihat detail Pepe", exact: true }).click();
  const accounts = {
    list: await page.locator(".mentions-metric").textContent(),
    detail: await page.locator(".coin-detail-header p").innerText(),
    displayedAuthors: await page.locator("dialog .post-author").allTextContents(),
    posts: await page.locator("dialog .post").count(),
  };
  record("Optional @ does not inflate account count", /1 akun/.test(accounts.list) && /2 post · 1 akun/.test(accounts.detail) && accounts.posts === 2, accounts);
  await page.keyboard.press("Escape");

  payload = { posts: [post("p1", "PEPE", "pengamat")] };
  await refreshVisible();
  await page.getByRole("button", { name: "Lihat detail Pepe", exact: true }).click();
  payload.posts[0].likes = 11;
  payload.posts.push(post("p2", "PEPE", "penyimak", 0, 20, 3));
  await refreshVisible();
  const updated = {
    list: await page.locator(".mentions-metric").textContent(),
    detail: await page.locator(".coin-detail-header p").innerText(),
    posts: await page.locator("dialog .post").count(),
    newest: await page.locator("dialog .post p").first().innerText(),
    likes: await page.locator("dialog .post-bottom > span:first-child").allTextContents(),
    reposts: await page.locator("dialog .post-bottom > span:nth-child(2)").allTextContents(),
  };
  record("Open detail reflects automatic refresh", /2 post · 2 akun/.test(updated.detail) && updated.posts === 2 && updated.newest.includes("p2") && updated.likes.join(",") === "20,11" && updated.reposts[0] === "3", updated);

  payload.posts.push(post("p3", "PEPE", "ketiga", 0));
  const pollResponse = page.waitForResponse("https://feed.nyimak.test/revision");
  await page.clock.fastForward(60_100);
  await pollResponse;
  await page.waitForFunction(() => document.querySelector(".coin-list")?.getAttribute("aria-busy") === "false");
  const polled = { detail: await page.locator(".coin-detail-header p").innerText(), posts: await page.locator("dialog .post").count() };
  record("Open detail reflects the 60-second poll", /3 post · 3 akun/.test(polled.detail) && polled.posts === 3, polled);

  // Exercise the same dialog through expiration and return without closing it.
  payload = { posts: [post("expired", "PEPE", "pengamat", 49)] };
  await refreshVisible();
  const expired = {
    posts: await page.locator("dialog .post").count(),
    detail: await page.locator(".coin-detail-header p").innerText(),
    empty: (await page.locator("dialog .empty-state").allTextContents()).join(" "),
    title: await page.locator("#dialog-title").innerText(),
  };
  record("Expired coin stays open with an honest empty state", expired.posts === 0 && /0 post · 0 akun/.test(expired.detail) && /Belum ada post/.test(expired.empty ?? "") && expired.title === "Percakapan $PEPE", expired);
  payload = { posts: [post("returned", "PEPE", "@PENGAMAT", 0)] };
  await refreshVisible();
  record("Open detail recovers when matching posts return", await page.locator("dialog .post").count() === 1 && (await page.locator("dialog .post p").innerText()).includes("returned"), { posts: await page.locator("dialog .post").count() });
  await page.keyboard.press("Escape");

  // Expiration caused by the clock also updates an already-open detail.
  payload = { posts: [post("aging", "PEPE", "pengamat", 47.995)] };
  payload.posts[0].createdAt = new Date(await page.evaluate(() => Date.now()) - 47.995 * 3_600_000).toISOString();
  await refreshVisible();
  await page.getByRole("button", { name: "Lihat detail Pepe", exact: true }).click();
  await page.clock.fastForward(30_100);
  await page.waitForFunction(() => document.querySelectorAll(".coin-row").length === 0);
  record("Open detail expires with the 48-hour window", await page.locator("dialog .post").count() === 0 && await page.locator("dialog .empty-state").count() === 1, { posts: await page.locator("dialog .post").count(), listRows: await page.locator(".coin-row").count() });
  record("No script or local resource failures", errors.length === 0, errors);
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
  await writeFile(resolve(out, baseline ? "revision-baseline.json" : "revision-results.json"), JSON.stringify(results, null, 2) + "\n");
}
if (!baseline) assert.ok(results.checks.every((item) => item.passed), "Revision checks failed; see artifacts/revision-results.json");
