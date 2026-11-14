// Records a real, scripted walkthrough of the running app as a JPEG frame sequence
// (Chrome DevTools screencast) plus an event log of taps and caption marks.
// Usage: node scripts/record.mjs   (app must be running on http://localhost:5173)
// Output: public/rec/*.jpg and src/recording.json
// NOTE: starts by clearing the app's data, then loads the demo data and adds a
// top-up and an expense as part of the walkthrough.
import puppeteer from "puppeteer-core"
import { mkdir, rm, writeFile } from "node:fs/promises"

const APP_URL = process.env.APP_URL ?? "http://localhost:5173"
const OUT = "public/rec/"
await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  protocolTimeout: 60000,
})
const page = await browser.newPage()
page.on("dialog", (d) => d.accept())
await browser.defaultBrowserContext().overridePermissions(APP_URL, ["clipboard-read", "clipboard-write", "clipboard-sanitized-write"])
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- reset to onboarding (not recorded)
await page.goto(APP_URL, { waitUntil: "networkidle2" })
await sleep(1500)
if (!page.url().includes("onboarding")) {
  await page.evaluate(() => document.querySelector('[aria-label="Your budget"]').click())
  await sleep(600)
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Clear all data")).click())
  await page.waitForFunction(() => location.pathname.includes("onboarding"), { timeout: 30000 })
}
await sleep(1500)

// ---------- recording
const cdp = await page.createCDPSession()
const frames = []
const events = []
let t0 = 0
const now = () => Date.now() / 1000 - t0
let n = 0
cdp.on("Page.screencastFrame", async ({ data, sessionId }) => {
  const t = now()
  const file = `${String(n++).padStart(5, "0")}.jpg`
  frames.push({ t: +t.toFixed(3), f: file })
  writeFile(OUT + file, Buffer.from(data, "base64"))
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {})
})

const mark = (label, extra = {}) => events.push({ type: "mark", t: +now().toFixed(3), label, ...extra })
const zoom = (y, scale = 1.5) => events.push({ type: "zoom", t: +now().toFixed(3), y, scale })
const unzoom = () => events.push({ type: "zoom", t: +now().toFixed(3), y: 422, scale: 1 })

async function boxOf(handle) {
  await handle.evaluate((el) => el.scrollIntoView({ block: "nearest" }))
  const b = await handle.boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
async function tap(handle, pause = 450) {
  const { x, y } = await boxOf(handle)
  events.push({ type: "tap", t: +now().toFixed(3), x: Math.round(x), y: Math.round(y) })
  await sleep(180)
  await page.mouse.click(x, y)
  await sleep(pause)
}
const byText = (text, tag = "button", within = "") =>
  page.waitForSelector(`::-p-xpath(${within}//${tag}[contains(normalize-space(.), ${JSON.stringify(text)})])`, { timeout: 15000 })
const byLabel = (label) => page.waitForSelector(`[aria-label=${JSON.stringify(label)}]`, { timeout: 15000 })
const sheet = "//*[@role='dialog']"

async function type(text, delay = 120) {
  await page.keyboard.type(text, { delay })
}
async function clearField() {
  await page.evaluate(() => document.activeElement?.select?.())
  await sleep(250)
  await page.keyboard.press("Backspace")
}
async function scrollTo(target, ms = 1400) {
  await page.evaluate(
    (target, ms) =>
      new Promise((resolve) => {
        const el = typeof target === "string" ? [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === target) : null
        const max = document.documentElement.scrollHeight - innerHeight
        const to = Math.min(max, Math.max(0, el ? el.getBoundingClientRect().top + scrollY - 70 : target))
        const from = scrollY
        const start = performance.now()
        const step = (t) => {
          const p = Math.min(1, (t - start) / ms)
          const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
          scrollTo(0, from + (to - from) * e)
          p < 1 ? requestAnimationFrame(step) : resolve()
        }
        requestAnimationFrame(step)
      }),
    target,
    ms,
  )
  await sleep(250)
}
async function swipeJars(dx, ms = 1200) {
  await page.evaluate(
    (dx, ms) =>
      new Promise((resolve) => {
        const el = [...document.querySelectorAll("div")].find((d) => d.className.includes("snap-x"))
        el.style.scrollSnapType = "none"
        const from = el.scrollLeft
        const start = performance.now()
        const step = (t) => {
          const p = Math.min(1, (t - start) / ms)
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
          el.scrollLeft = from + dx * e
          p < 1 ? requestAnimationFrame(step) : resolve()
        }
        requestAnimationFrame(step)
      }),
    dx,
    ms,
  )
}

await cdp.send("Page.startScreencast", { format: "jpeg", quality: 82, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 })
t0 = Date.now() / 1000
// Nudge compositing so the first frame arrives immediately
await page.evaluate(() => scrollTo(0, 1)); await page.evaluate(() => scrollTo(0, 0))

// 1. Onboarding
mark("onboarding")
await sleep(5500)
await tap(await byText("Try demo"), 200)
await page.waitForFunction(() => document.body.innerText.includes("Your jars"), { timeout: 30000 })
await sleep(800)

// 2. Hero
mark("hero")
zoom(190, 1.45)
await sleep(7000)
unzoom()
await sleep(2500)

// 3. Forecast — test a purchase
mark("forecast")
await scrollTo("Your cash-flow forecast", 1600)
await sleep(5000)
mark("purchase-safe")
zoom(560, 1.35)
await tap(await byLabel("e.g. new headphones"))
await type("AirPods")
await tap(await byLabel("Purchase amount (HK$)"))
await type("1290", 160)
await sleep(2000)
mark("purchase-goal")
await sleep(4000)
mark("purchase-danger")
await clearField()
await sleep(300)
await type("99000", 160)
await sleep(6500)
await clearField()
await tap(await byLabel("e.g. new headphones"), 200)
await clearField()
unzoom()
await sleep(800)

// 4. Jars
mark("jars")
await scrollTo("Your jars", 1400)
await sleep(3000)
await swipeJars(620, 2600)
await sleep(1200)
await swipeJars(-620, 1800)
await sleep(1000)

// 5. Top up a jar
mark("topup")
await tap(await byText("Top up jar", "button", "//main"), 900)
const topUpAmount = await page.waitForSelector(`::-p-xpath(${sheet}//input[@placeholder='500'])`)
await tap(topUpAmount)
await type("300", 160)
await sleep(900)
await tap(await byText("Add top-up", "button", sheet), 1500)
mark("topup-done")
zoom(330, 1.4)
await sleep(5000)
unzoom()
await sleep(600)

// 6a. Quick log with AI
mark("quicklog")
await tap(await byText("Quick log", "button", "//nav"), 1000)
await tap(await page.waitForSelector(`::-p-xpath(${sheet}//textarea)`))
await type("char siu rice 48 octopus, bubble tea 32 payme", 70)
await sleep(600)
mark("quicklog-parse")
await tap(await byText("Read it", "button", sheet), 300)
await page.waitForSelector(`::-p-xpath(${sheet}//button[starts-with(normalize-space(.), 'Save ')])`, { timeout: 60000 })
mark("quicklog-review")
await sleep(4500)
await tap(await page.waitForSelector(`::-p-xpath(${sheet}//button[starts-with(normalize-space(.), 'Save ')])`), 1200)
mark("quicklog-saved")
await sleep(5000)
await tap(await byText("Done", "button", sheet), 1000)

// 6b. Log an expense (full form)
mark("expense")
await tap(await byText("Log expense", "button", "//nav"), 900)
await tap(await page.waitForSelector(`::-p-xpath(${sheet}//input[@placeholder='e.g. Cha chaan teng lunch'])`))
await type("Bubble tea")
await tap(await page.waitForSelector(`::-p-xpath(${sheet}//input[@placeholder='38'])`))
await type("32", 160)
await sleep(400)
await tap(await byText("Food", "button", sheet), 500)
await tap(await byText("Octopus", "button", sheet), 600)
mark("roundup")
await tap(await byText("Japan Travel Fund", "button", sheet), 1200)
await tap(await byText("Add expense", "button", sheet), 1500)
await sleep(1500)

// 7. Payday split
mark("payday")
await tap(await byText("Payday split", "button", "//nav"), 900)
await sleep(4500)
await page.keyboard.press("Escape")
await sleep(1000)

// 7b. Weekly challenge + share recap
mark("challenge")
await scrollTo("This week", 1600)
await sleep(2500)
await tap(await byText("Save 3 times"), 1500)
mark("challenge-on")
zoom(330, 1.3)
await sleep(3500)
mark("share")
await tap(await byText("Share my week"), 2500)
unzoom()
await sleep(800)

// 8. This month / categories / recent / insights
mark("month")
await scrollTo("This month", 1600)
await sleep(3500)
await scrollTo((await page.evaluate(() => scrollY)) + 300, 1400)
await sleep(3500)
mark("categories")
await scrollTo("Spending by category", 1400)
await sleep(3500)
mark("recent")
await scrollTo("Recent activity", 1400)
zoom(360, 1.35)
await sleep(5000)
unzoom()
mark("insights")
await scrollTo("Insights", 1600)
await sleep(4500)
await scrollTo((await page.evaluate(() => scrollY)) + 380, 1400)
await sleep(3000)
mark("cutback")
await scrollTo(99999, 1400)
await sleep(800)
zoom(560, 1.35)
await tap(await page.waitForSelector("#skip"), 500)
for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowRight"); await sleep(1100) }
await sleep(4000)
unzoom()

// 9. Privacy, language, dark mode
await scrollTo(0, 2200)
await sleep(600)
mark("privacy")
await tap(await byLabel("Hide balances"), 4000)
await tap(await byLabel("Show balances"), 1200)
mark("language")
await tap(await byLabel("EN / 中"), 3500)
await scrollTo(700, 1600)
await sleep(1500)
await scrollTo(0, 1200)
await tap(await byLabel("中 / EN"), 1200)
mark("dark")
await tap(await byLabel("Dark mode"), 3500)
await scrollTo(900, 2000)
await sleep(1500)
await scrollTo(0, 1500)
await sleep(1500)
await tap(await byLabel("Dark mode"), 1500)
mark("end")
await sleep(2500)

await cdp.send("Page.stopScreencast")
const duration = +now().toFixed(3)
await sleep(500)
await writeFile("src/recording.json", JSON.stringify({ duration, frames, events }))
console.log(`recorded ${frames.length} frames over ${duration}s, ${events.length} events`)
await browser.close()
