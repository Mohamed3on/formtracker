/**
 * Solves the Transfermarkt AWS WAF CAPTCHA via Playwright + 2captcha.
 *
 * Flow: Playwright loads the CAPTCHA page → 2captcha solves it → Playwright
 * injects the voucher via the AWS WAF SDK → extracts the minted cookie.
 *
 * Outputs the aws-waf-token cookie to stdout.
 * Skips solving if TM_COOKIE env var is still valid.
 */

import { chromium } from "playwright";
import { forceTmProxy, proxyInit, proxyLaunchOption } from "../lib/proxy";

const API_KEY = process.env.TM_2CAPTCHA_KEY;
if (!API_KEY) {
  console.error("Missing TM_2CAPTCHA_KEY env var");
  process.exit(1);
}

const TM_URL = "https://www.transfermarkt.com/";
const VALIDATE_URL = "https://www.transfermarkt.com/x/leistungsdaten/spieler/28003"; // Messi — always exists
const POLL_INTERVAL = 5_000;
const MAX_POLLS = 60;

async function solveCaptcha(): Promise<string> {
  const browser = await chromium.launch({ headless: true, ...proxyLaunchOption() });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    console.error("[captcha] Opening Transfermarkt in Playwright...");
    await page.goto(TM_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Extract CAPTCHA params from page
    const params = await page.evaluate(() => {
      const props = (window as any).gokuProps;
      const scripts = [...document.querySelectorAll("script[src]")].map(
        (s) => s.getAttribute("src") || "",
      );
      return {
        sitekey: props?.key,
        iv: props?.iv,
        context: props?.context,
        challengeScript: scripts.find((s) => s.includes("challenge.js")),
        captchaScript: scripts.find((s) => s.includes("captcha.js")),
      };
    });

    if (!params.sitekey) throw new Error("No gokuProps found on page");

    // Submit to 2captcha
    console.error("[captcha] Submitting to 2captcha...");
    const createRes = await fetch("https://api.2captcha.com/createTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: API_KEY,
        task: {
          type: "AmazonTaskProxyless",
          websiteURL: TM_URL,
          websiteKey: params.sitekey,
          iv: params.iv,
          context: params.context,
          challengeScript: params.challengeScript,
          captchaScript: params.captchaScript,
        },
      }),
    });
    const { taskId, errorId, errorDescription } = await createRes.json();
    if (errorId) throw new Error(`2captcha submit failed: ${errorDescription}`);
    console.error(`[captcha] Task ${taskId}, polling...`);

    // Poll for voucher
    let voucher = "";
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      const pollRes = await fetch("https://api.2captcha.com/getTaskResult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey: API_KEY, taskId }),
      });
      const data = await pollRes.json();
      if (data.status === "ready") {
        voucher = data.solution.captcha_voucher;
        break;
      }
      if (data.errorId) throw new Error(`2captcha solve failed: ${data.errorDescription}`);
      console.error(`[captcha] Waiting... (${i + 1}/${MAX_POLLS})`);
    }
    if (!voucher) throw new Error("2captcha timed out");

    // Inject voucher into page via AWS WAF SDK
    console.error("[captcha] Injecting voucher...");
    await page.evaluate(async (v) => {
      await (window as any).ChallengeScript.submitCaptcha(v);
    }, voucher);
    await page.waitForTimeout(3000);

    // Extract cookie
    const cookies = await context.cookies();
    const wafCookie = cookies.find((c) => c.name === "aws-waf-token");
    if (!wafCookie) throw new Error("No aws-waf-token cookie set after voucher injection");

    const cookie = `aws-waf-token=${wafCookie.value}`;

    // Verify with plain fetch — that's how the refresh script will use it.
    // Probe 3 stacks in parallel to distinguish IP block, cookie rejection, and Node-fetch fingerprint issues.
    console.error("[captcha] Verifying token with fetch...");
    const UA =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
    const [withCookie, noCookie, viaBrowser] = await Promise.all([
      fetch(VALIDATE_URL, { headers: { "User-Agent": UA, Cookie: cookie }, ...proxyInit() }),
      fetch(VALIDATE_URL, { headers: { "User-Agent": UA }, ...proxyInit() }),
      context.request.get(VALIDATE_URL).catch((e) => ({ status: () => `err:${e}` })),
    ]);
    const body = (await withCookie.text()).slice(0, 200).replace(/\s+/g, " ");
    console.error(
      `[verify] node+cookie=${withCookie.status} node+nocookie=${noCookie.status} playwright=${viaBrowser.status()}`,
    );
    console.error(
      `[verify] waf-action=${withCookie.headers.get("x-amzn-waf-action")} server=${withCookie.headers.get("server")} body="${body}"`,
    );
    if (withCookie.status !== 200) {
      throw new Error(`Token failed fetch verification (HTTP ${withCookie.status})`);
    }
    console.error("[captcha] Token verified.");

    return cookie;
  } finally {
    await browser.close();
  }
}

const MAX_SOLVE_ATTEMPTS = 3;

async function main() {
  // Captcha solving only runs when the direct IP is already WAF-blocked, so mint the fresh
  // cookie through the proxy (its Playwright session + verify fetches) rather than direct.
  forceTmProxy();
  for (let attempt = 1; attempt <= MAX_SOLVE_ATTEMPTS; attempt++) {
    try {
      console.error(`[captcha] Solving fresh cookie (attempt ${attempt}/${MAX_SOLVE_ATTEMPTS})...`);
      const cookie = await solveCaptcha();
      console.log(cookie);
      console.error("[captcha] Done!");
      return;
    } catch (err) {
      console.error(`[captcha] Attempt ${attempt} failed: ${err}`);
      if (attempt === MAX_SOLVE_ATTEMPTS) throw err;
    }
  }
}

main().catch((err) => {
  console.error("[captcha] Fatal:", err);
  process.exit(1);
});
