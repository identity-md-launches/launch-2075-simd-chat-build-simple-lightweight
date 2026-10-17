import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

// Exercises the committed production export, including a real fetch boundary mocked at the network.
const dependencyRoot = process.env.NYIMAK_NODE_MODULES;
const { chromium, webkit } = await import(
  dependencyRoot
    ? pathToFileURL(`${dependencyRoot}/playwright/index.mjs`).href
    : "playwright"
);
const require = createRequire(import.meta.url);
const axePath = dependencyRoot
  ? `${dependencyRoot}/axe-core/axe.min.js`
  : require.resolve("axe-core/axe.min.js");
const root = resolve("dist");
const out = resolve("artifacts");
await mkdir(out, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!path.startsWith("/preview/")) {
      res.writeHead(404).end();
      return;
    }
    const file = resolve(root, path.slice("/preview/".length) || "index.html");
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!(await stat(file)).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] ?? "application/octet-stream",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = {
  date: new Date().toISOString(),
  export: "dist/ served at /preview/",
  browsers: [],
  checks: [],
  limitations: [],
};
function check(name, detail) {
  results.checks.push({ name, passed: true, detail });
  console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
}
const now = Date.now();
const post = (
  id,
  text,
  ageHours,
  likes = 10,
  reposts = 2,
  author = "fixture_alpha",
) => ({
  id,
  text,
  author,
  createdAt: new Date(now - ageHours * 3_600_000).toISOString(),
  likes,
  reposts,
});
const a = post("a", "meme $PEPE", 0.08);
const fixture = {
  posts: [
    a,
    post("b", "Meme $PEPE $BONK $PEPE", 25, 4, 1, "fixture_beta"),
    a,
    post("c", "meme $BONK", 0.16, 30, 4),
    post("d", "meme $pepe", 0.33, 1, 0, "FIXTURE_ALPHA"),
    post("old", "meme $OLD", 49),
    post("no-keyword", "cerita $SKIP", 1),
    post("no-ticker", "meme saja", 1),
    post("future", "meme $FUTURE", -1),
  ],
};
let failed = false;

try {
  for (const [name, engine] of [
    ["Chromium", chromium],
    ["WebKit", webkit],
  ]) {
    let browser;
    try {
      browser = await engine.launch({ headless: true, timeout: 10000 });
    } catch (error) {
      results.browsers.push({
        name,
        status: "unavailable",
        reason: error.message.split("\n").filter(Boolean).slice(0, 5).join(" "),
      });
      results.limitations.push(
        `${name} could not launch on this machine. See browsers[].reason.`,
      );
      console.log(`UNAVAILABLE ${name}: ${error.message.split("\n")[0]}`);
      continue;
    }
    results.browsers.push({
      name,
      version: browser.version(),
      status: "tested",
    });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const scriptErrors = [];
    const localFailures = [];
    page.on("pageerror", (error) => scriptErrors.push(error.message));
    page.on("response", (response) => {
      if (response.url().startsWith(url) && response.status() >= 400)
        localFailures.push(`${response.status()} ${response.url()}`);
    });
    await page.clock.install({ time: new Date(now) });
    await page.goto(url);
    await page.locator(".coin-row").first().waitFor();
    assert.equal(await page.locator(".coin-row").count(), 8);
    assert.match(
      await page.locator(".source-badge").innerText(),
      /Data contoh/,
    );
    assert.equal(
      await page
        .locator(".summary-strip>div")
        .nth(1)
        .locator("strong")
        .innerText(),
      "124",
    );
    check(
      `${name}: honest demo`,
      "8 coins, 124 computed example posts, visible sample disclosure",
    );

    await page
      .getByRole("button", { name: "Paling ramai", exact: true })
      .click();
    assert.equal(await page.locator(".coin-row").count(), 4);
    await page.getByRole("button", { name: "Semua koin", exact: true }).click();
    await page.getByRole("searchbox").fill("$pepe");
    assert.equal(await page.locator(".coin-row").count(), 1);
    await page.getByRole("searchbox").fill("tidak-ada-koin");
    assert.equal(await page.locator(".coin-row").count(), 0);
    assert.match(
      await page.locator(".empty-state").innerText(),
      /tidak-ada-koin/,
    );
    await page.getByRole("button", { name: "Lihat semua koin" }).click();
    assert.equal(await page.locator(".coin-row").count(), 8);
    check(
      `${name}: search and filters`,
      "case-insensitive $ticker, top four, empty result and recovery",
    );

    await page
      .getByRole("button", { name: "Simpan Pepe", exact: true })
      .click();
    await page
      .getByRole("group", { name: "Tampilkan koin" })
      .getByRole("button", { name: "Tersimpan" })
      .click();
    assert.equal(await page.locator(".coin-row").count(), 1);
    await page.reload();
    await page
      .getByRole("group", { name: "Tampilkan koin" })
      .getByRole("button", { name: "Tersimpan" })
      .click();
    assert.equal(await page.locator(".coin-row").count(), 1);
    await page
      .getByRole("button", { name: "Hapus Pepe dari simpanan", exact: true })
      .click();
    assert.match(
      await page.locator(".empty-state").innerText(),
      /Belum ada koin tersimpan/,
    );
    await page.getByRole("button", { name: "Lihat semua koin" }).click();
    check(
      `${name}: saved coins`,
      "add, persist after reload, saved-only view, remove, empty recovery",
    );

    const trigger = page.getByRole("button", {
      name: "Lihat detail Pepe",
      exact: true,
    });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    assert.equal(await page.locator("dialog .post").count(), 20);
    assert.match(await page.locator("dialog").innerText(), /32 post/);
    assert.match(await page.locator("dialog").innerText(), /Post contoh/);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => !!document.activeElement?.closest("dialog")),
        true,
      );
    }
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() =>
        document.activeElement?.getAttribute("aria-label"),
      ),
      "Lihat detail Pepe",
    );
    check(
      `${name}: keyboard and detail`,
      "Enter opens, native modal traps focus, Escape closes and restores trigger, 20 newest posts",
    );

    await page
      .getByRole("button", { name: "Sumber data", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "URL feed publik" })
      .fill("http://unsafe.test/");
    await page
      .getByRole("button", { name: "Hubungkan feed", exact: true })
      .click();
    assert.equal(
      await page.locator("#feed-url").getAttribute("aria-invalid"),
      "true",
    );
    assert.match(await page.locator("#feed-error").innerText(), /HTTPS/);
    let payload = fixture;
    let status = 200;
    let requests = 0;
    let networkError = false;
    let releaseFirstFeed;
    let signalFirstFeed;
    const firstFeedReady = new Promise((resolve) => {
      signalFirstFeed = resolve;
    });
    await page.route("https://feed.nyimak.test/posts", async (route) => {
      requests++;
      if (requests === 1) {
        await new Promise((resolve) => {
          releaseFirstFeed = resolve;
          signalFirstFeed();
        });
      }
      if (networkError) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(payload),
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    });
    await page
      .getByRole("textbox", { name: "URL feed publik" })
      .fill("https://feed.nyimak.test/posts");
    await page
      .getByRole("button", { name: "Hubungkan feed", exact: true })
      .click();
    await firstFeedReady;
    const pendingButton = page.getByRole("button", {
      name: "Menghubungkan…",
      exact: true,
    });
    await pendingButton.waitFor();
    assert.equal(await pendingButton.isDisabled(), true);
    assert.match(
      await page.locator(".source-badge").innerText(),
      /Data contoh/,
    );
    releaseFirstFeed();
    check(
      `${name}: pending connection`,
      "visible pending label and disabled submit; previous source remains active until the new feed succeeds",
    );
    await page.locator("dialog").waitFor({ state: "hidden" });
    assert.match(
      await page.locator(".source-badge").innerText(),
      /Feed terhubung/,
    );
    assert.equal(await page.locator(".coin-row").count(), 2);
    assert.equal(
      await page
        .locator(".summary-strip>div")
        .nth(1)
        .locator("strong")
        .innerText(),
      "4",
    );
    assert.equal(
      await page
        .locator(".coin-row")
        .first()
        .locator(".coin-identity strong")
        .innerText(),
      "Pepe",
    );
    assert.equal(
      await page
        .locator(".coin-row")
        .first()
        .locator(".mentions-metric strong")
        .textContent(),
      "3 post",
    );
    assert.equal(
      await page
        .locator(".coin-row")
        .first()
        .locator(".mentions-metric>span")
        .innerText(),
      "2 akun",
    );
    check(
      `${name}: feed integration`,
      "HTTPS validation, real fetch boundary, ID deduplication, meme + $ticker, 48h/future exclusion, account normalization",
    );

    await page
      .getByRole("combobox", { name: "Urutkan koin" })
      .selectOption("engagement");
    assert.equal(
      await page
        .locator(".coin-row")
        .first()
        .locator(".coin-identity strong")
        .innerText(),
      "Bonk",
    );
    await page
      .getByRole("combobox", { name: "Urutkan koin" })
      .selectOption("recent");
    assert.equal(
      await page
        .locator(".coin-row")
        .first()
        .locator(".coin-identity strong")
        .innerText(),
      "Pepe",
    );
    await page
      .getByRole("combobox", { name: "Jendela waktu" })
      .selectOption("24");
    assert.equal(
      await page
        .locator(".summary-strip>div")
        .nth(1)
        .locator("strong")
        .innerText(),
      "3",
    );
    await page
      .getByRole("combobox", { name: "Jendela waktu" })
      .selectOption("48");
    check(
      `${name}: time and ranking`,
      "24h removes a 25h post; mention, engagement and latest sort orders checked",
    );

    payload = { posts: [...fixture.posts, post("new", "meme $NEW", 0)] };
    const before = requests;
    await page.clock.fastForward(60_100);
    await page
      .getByRole("button", { name: "Lihat detail NEW", exact: true })
      .waitFor();
    assert.ok(requests > before);
    await page.getByRole("switch").click();
    const paused = requests;
    await page.clock.fastForward(60_100);
    assert.equal(requests, paused);
    await page.getByRole("switch").click();
    await page.clock.fastForward(60_100);
    await page.waitForFunction(
      () =>
        document.querySelector(".coin-list")?.getAttribute("aria-busy") ===
        "false",
    );
    assert.ok(requests > paused);
    check(
      `${name}: automatic updates`,
      "new coin appears after simulated 60s; pause stops requests; resume restores polling",
    );

    await page.reload();
    await page
      .getByRole("button", { name: "Lihat detail NEW", exact: true })
      .waitFor();
    assert.match(
      await page.locator(".source-badge").innerText(),
      /Feed terhubung/,
    );
    check(
      `${name}: source persistence`,
      "reload fetches the previously connected feed without showing demo data",
    );

    networkError = true;
    await page.getByRole("button", { name: "Perbarui", exact: true }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator(".coin-row").count(), 3);
    assert.match(await page.getByRole("alert").innerText(), /Data terakhir/);
    networkError = false;
    await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
    await page.getByRole("alert").waitFor({ state: "hidden" });
    check(
      `${name}: failed refresh and retry`,
      "network error retains last successful results, retry clears error",
    );

    await page
      .getByRole("button", { name: "Sumber data", exact: true })
      .click();
    status = 503;
    await page
      .getByRole("button", { name: "Hubungkan feed", exact: true })
      .click();
    await page.locator("#feed-error").waitFor();
    assert.match(await page.locator("#feed-error").innerText(), /503/);
    assert.equal(await page.locator(".coin-row").count(), 3);
    status = 200;
    payload = { posts: [{ id: "broken" }] };
    await page
      .getByRole("button", { name: "Hubungkan feed", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector("#feed-error")
        ?.textContent.includes("tidak lengkap"),
    );
    assert.equal(await page.locator(".coin-row").count(), 3);
    payload = { posts: [] };
    await page
      .getByRole("button", { name: "Hubungkan feed", exact: true })
      .click();
    await page.locator("dialog").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".coin-row").count(), 0);
    assert.match(
      await page.locator(".empty-state").innerText(),
      /Belum ada post/,
    );
    check(
      `${name}: feed error and empty states`,
      "HTTP 503, malformed post, retained previous source, valid empty feed",
    );

    await page
      .getByRole("button", { name: "Sumber data", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Gunakan data contoh", exact: true })
      .click();
    assert.equal(await page.locator(".coin-row").count(), 8);
    assert.match(
      await page.locator(".source-badge").innerText(),
      /Data contoh/,
    );

    await page.addScriptTag({ path: axePath });
    const audit = await page.evaluate(async () => {
      const result = await window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      });
      return {
        violations: result.violations.map((item) => ({
          id: item.id,
          impact: item.impact,
          nodes: item.nodes.map((node) => node.target),
        })),
        passedRules: result.passes.length,
        incompleteRules: result.incomplete.length,
        incomplete: result.incomplete.map((item) => ({
          id: item.id,
          nodes: item.nodes.map((node) => node.target),
        })),
      };
    });
    results.audits ??= [];
    results.audits.push({ browser: name, ...audit });
    assert.deepEqual(audit.violations, []);
    check(
      `${name}: automated accessibility`,
      `${audit.passedRules} axe rules passed, zero violations; ${audit.incompleteRules} rules require manual review`,
    );

    for (const width of [320, 390, 630, 768, 960, 1150, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `Overflow at ${width}px`,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    assert.ok(
      await page
        .getByRole("button", { name: "Perbarui", exact: true })
        .evaluate((el) => el.getBoundingClientRect().bottom < innerHeight),
    );
    assert.ok(
      await page
        .locator(".coin-row")
        .first()
        .evaluate((el) => el.getBoundingClientRect().bottom < innerHeight),
    );
    assert.equal(
      await page
        .locator("button")
        .evaluateAll((elements) =>
          elements
            .filter((el) => el.checkVisibility())
            .every(
              (el) =>
                !!(el.textContent.trim() || el.getAttribute("aria-label")),
            ),
        ),
      true,
    );
    assert.equal(
      await page.evaluate(() => document.fonts.check("400 14px Manrope")),
      true,
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
      0,
    );
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `Text enlargement overflow at ${width}`,
      );
    }
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    check(
      `${name}: text enlargement`,
      "200% root text size at 320, 390 and 1440: no horizontal page overflow; distinct from native browser zoom",
    );
    assert.deepEqual(scriptErrors, []);
    assert.deepEqual(localFailures, []);
    check(
      `${name}: responsive production export`,
      "no overflow at 320/390/630/768/960/1150/1440; complete first row and refresh visible at 390×844; named buttons; local font; reduced motion; no script/local-resource errors",
    );
    if (name === "Chromium") {
      await page.screenshot({
        path: resolve(out, "mobile-390.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({
        path: resolve(out, "desktop-1440.png"),
        fullPage: true,
      });
    }
    await browser.close();
  }
  assert.ok(
    results.browsers.some((browser) => browser.status === "tested"),
    "No browser could run",
  );
} catch (error) {
  failed = true;
  results.checks.push({
    name: "validation failure",
    passed: false,
    detail: error.stack,
  });
  console.error(error);
} finally {
  await writeFile(
    resolve(out, "interaction-results.json"),
    JSON.stringify(results, null, 2) + "\n",
  );
  await new Promise((done) => server.close(done));
}
process.exit(failed ? 1 : 0);
