"""Browser QA for the CRM with a saved session (see login_once.py).

Usage: python crm_e2e.py <base url> <state file> <out dir> [--write]
Per screen, desktop 1280 and phone 375: HTTP status, horizontal overflow, html dir=rtl,
phone numbers inside an LTR element, axe-core serious/critical violations, and a screenshot.
--write also runs the customer happy path: create, edit, check after reload, delete.
"""
import asyncio, json, re, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE, STATE, OUT = sys.argv[1].rstrip("/"), sys.argv[2], Path(sys.argv[3])
WRITE = "--write" in sys.argv
AXE = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js"
SCREENS = ["/", "/customers", "/customers/new", "/appointments", "/appointments/new", "/tickets", "/tickets/new", "/team"]
VIEWPORTS = {"desktop": {"width": 1280, "height": 800}, "phone": {"width": 375, "height": 812}}

CHECK_JS = """() => {
  const phone = /0\\d{1,2}-?\\d{3}-?\\d{4}/;
  const unwrapped = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!phone.test(n.textContent)) continue;
    const el = n.parentElement;
    if (!el || el.closest('script,style')) continue;
    if (getComputedStyle(el).direction !== 'ltr') unwrapped.push(n.textContent.trim().slice(0, 40));
  }
  return {
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    dir: document.documentElement.getAttribute('dir'),
    unwrappedPhones: unwrapped.slice(0, 5),
    title: document.title,
  };
}"""


async def audit(page, path, vp):
    resp = await page.goto(BASE + path, wait_until="networkidle")
    info = await page.evaluate(CHECK_JS)
    await page.add_script_tag(url=AXE)
    axe = await page.evaluate("""async () => {
      const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] });
      return r.violations.filter(v => ['serious', 'critical'].includes(v.impact))
        .map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') }));
    }""")
    name = (path.strip("/").replace("/", "_") or "home") + f"-{vp}.png"
    await page.screenshot(path=str(OUT / name), full_page=True)
    return {"path": path, "viewport": vp, "status": resp.status if resp else None, "final_url": page.url.replace(BASE, ""),
            **info, "axe": axe, "screenshot": name}


async def happy_path(page):
    steps = []
    page.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
    await page.goto(BASE + "/customers/new", wait_until="networkidle")
    await page.fill("#full_name", "לקוחת בדיקה E2E")
    await page.fill("#phone", "054-999-0001")
    await page.click("form:has(#full_name) button[type=submit]")
    await page.wait_for_url(re.compile(r"/customers/[0-9a-f-]{36}"), timeout=20000)
    card = page.url.split("?")[0]
    steps.append(("יצירת לקוחה", "לקוחת בדיקה E2E" in await page.inner_text("body")))
    await page.goto(card + "/edit", wait_until="networkidle")
    await page.fill("#notes", "נבדק ב-E2E")
    await page.click("form:has(#full_name) button[type=submit]")
    await page.wait_for_url(re.compile(r"/customers/[0-9a-f-]{36}"), timeout=20000)
    await page.reload(wait_until="networkidle")
    steps.append(("עריכה נשמרת אחרי רענון", "נבדק ב-E2E" in await page.inner_text("body")))
    await page.goto(BASE + "/customers/new", wait_until="networkidle")
    await page.fill("#full_name", "כפילות")
    await page.fill("#phone", "0549990001")
    await page.click("form:has(#full_name) button[type=submit]")
    await page.wait_for_timeout(2500)
    steps.append(("טלפון קיים נחסם עם הודעה", "כבר שייך" in await page.inner_text("body")))
    await page.goto(card, wait_until="networkidle")
    await page.click("text=מחיקת הלקוחה")
    await page.wait_for_url(re.compile(r"/customers(\?|$)"), timeout=20000)
    steps.append(("מחיקה (BR-14)", "/customers" in page.url))
    return steps


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    results, steps = [], []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for vp, size in VIEWPORTS.items():
            ctx = await browser.new_context(storage_state=STATE, viewport=size, locale="he-IL")
            page = await ctx.new_page()
            for path in SCREENS:
                try:
                    results.append(await audit(page, path, vp))
                except Exception as e:
                    results.append({"path": path, "viewport": vp, "error": str(e)[:200]})
            if WRITE and vp == "desktop":
                try:
                    steps = await happy_path(page)
                except Exception as e:
                    steps.append(("happy path", f"error: {str(e)[:150]}"))
            await ctx.close()
        await browser.close()
    (OUT / "results.json").write_text(json.dumps({"screens": results, "happy_path": steps}, ensure_ascii=False, indent=2), encoding="utf-8")
    for r in results:
        if "error" in r:
            print(f"✗ {r['viewport']:7} {r['path']}: {r['error']}")
            continue
        issues = []
        if r["status"] != 200: issues.append(f"status {r['status']}")
        if r["final_url"].startswith("/login"): issues.append("redirected to login")
        if r["overflow"] > 0: issues.append(f"overflow {r['overflow']}px")
        if r["dir"] != "rtl": issues.append(f"dir={r['dir']}")
        if r["unwrappedPhones"]: issues.append(f"phones not LTR: {r['unwrappedPhones']}")
        issues += [f"axe {a['impact']} {a['id']} x{a['nodes']} ({a['sample']})" for a in r["axe"]]
        print(f"{'✓' if not issues else '✗'} {r['viewport']:7} {r['path']}: {'; '.join(issues) or 'ok'}")
    for name, ok in steps:
        print(f"{'✓' if ok is True else '✗'} {name}: {ok}")


asyncio.run(main())
