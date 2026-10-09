"""Runs the agent test cases against the public CloudChat preview link, headless.

Usage: python run_agent_tests.py "<agent url>" [case ids...]
Each case gets a fresh browser context, i.e. a new anonymous chat user.
Writes results-<timestamp>.json and results-<timestamp>.md next to this file.
Ticket expectations are checked afterwards in SQL (the runner has no database access).
"""
import asyncio, difflib, json, re, sys, time
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import async_playwright

HERE = Path(__file__).parent
URL = sys.argv[1]
ONLY = {int(x) for x in sys.argv[2:]}
CASES = [c for c in json.loads((HERE / "cases.json").read_text(encoding="utf-8")) if not ONLY or c["id"] in ONLY]

# second person singular, masculine or feminine (the agent must address the user in neutral plural)
GENDERED = re.compile(r"(?<![א-ת])(תרצה|תרצי|אליך|אלייך|אותך|עבורך|בשבילך|לך|תוכל|תוכלי|הגעת|כתבת|שלחת)(?![א-ת])")
SLASH = re.compile(r"[א-ת]/[א-ת]")
# a period or comma right after a number flips sides in RTL chat bubbles
NUM_PUNCT = re.compile(r"\S\d[.,](?:\s|$)")
SETTLE_S = 7
MAX_WAIT_S = 75


async def chat_frame(page):
    for _ in range(40):
        for f in page.frames:
            if "sdk.dfktv2.com/widget" in f.url:
                if await f.locator("textarea.user-message-input").count():
                    return f
        await page.wait_for_timeout(500)
    raise RuntimeError("chat frame not found")


async def body_lines(frame):
    txt = await frame.evaluate("() => document.body.innerText")
    return [l.strip() for l in txt.splitlines() if l.strip()]


async def wait_reply(frame, before, sent):
    """Lines added after sending, once the chat has been quiet for SETTLE_S seconds."""
    start = time.monotonic()
    last, last_change = before, time.monotonic()
    while time.monotonic() - start < MAX_WAIT_S:
        await asyncio.sleep(1)
        now = await body_lines(frame)
        if now != last:
            last, last_change = now, time.monotonic()
        added = [l for l in new_lines(before, last) if l != sent and not re.fullmatch(r"\d{1,2}:\d{2}( [AP]M)?|היום|\.\.\.", l)]
        if added and time.monotonic() - last_change >= SETTLE_S:
            return added
    return [l for l in new_lines(before, last) if l != sent]


def new_lines(a, b):
    out = []
    for op, _, _, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op in ("insert", "replace"):
            out.extend(b[j1:j2])
    return out


async def run_case(browser, case):
    ctx = await browser.new_context(locale="he-IL", viewport={"width": 420, "height": 860})
    page = await ctx.new_page()
    await page.goto(URL, wait_until="networkidle")
    frame = await chat_frame(page)
    # the first message is swallowed if it is sent before the greeting arrives
    greet_deadline = time.monotonic() + 25
    while time.monotonic() < greet_deadline and not any("במה אפשר לעזור" in l for l in await body_lines(frame)):
        await asyncio.sleep(1)
    transcript = []
    for msg in case["turns"]:
        before = await body_lines(frame)
        box = frame.locator("textarea.user-message-input")
        await box.fill(msg)
        await box.press("Enter")
        reply = await wait_reply(frame, before, msg)
        transcript.append({"user": msg, "agent": reply})
    await ctx.close()

    agent_all = "\n".join(l for t in transcript for l in t["agent"])
    problems = []
    for rx in case.get("must", []):
        if not re.search(rx, agent_all):
            problems.append(f"חסר: {rx}")
    for rx in case.get("must_not", []):
        m = re.search(rx, agent_all)
        if m:
            problems.append(f"אסור: {m.group(0)}")
    m = GENDERED.search(agent_all)
    if m:
        problems.append(f"לשון לא ניטרלית: {m.group(0)}")
    m = SLASH.search(agent_all)
    if m:
        problems.append(f"לוכסן: {m.group(0)}")
    if "max_lines_last" in case and len(transcript[-1]["agent"]) > case["max_lines_last"]:
        problems.append(f"ארוך: {len(transcript[-1]['agent'])} שורות")
    if not all(t["agent"] for t in transcript):
        problems.append("אין תשובה לאחת ההודעות")
    warn = [m.group(0).strip() for m in NUM_PUNCT.finditer(agent_all)]
    return {**case, "transcript": transcript, "problems": problems, "rtl_warnings": warn,
            "passed_text": not problems}


async def main():
    started = datetime.now(timezone.utc)
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for case in CASES:
            try:
                r = await run_case(browser, case)
            except Exception as e:  # one broken case must not stop the run
                r = {**case, "transcript": [], "problems": [f"שגיאת הרצה: {e}"], "rtl_warnings": [], "passed_text": False}
            results.append(r)
            mark = "✓" if r["passed_text"] else "✗"
            print(f"{mark} {r['id']:>2} {r['topic']}: {'; '.join(r['problems']) or 'ok'}", flush=True)
        await browser.close()

    stamp = started.strftime("%Y%m%d-%H%M")
    out = {"started_utc": started.isoformat(), "url": URL, "results": results}
    (HERE / f"results-{stamp}.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    md = [f"# תוצאות בדיקת הסוכן · {started.astimezone().strftime('%d.%m.%Y %H:%M')}", "",
          "| # | נושא | ציפייה | תוצאה טקסטואלית | הערות |", "|---|---|---|---|---|"]
    for r in results:
        md.append(f"| {r['id']} | {r['topic']} | {r['expect']} | {'✓' if r['passed_text'] else '✗'} | "
                  f"{'; '.join(r['problems'] + [f'RTL: {w}' for w in r['rtl_warnings']]).replace('|', '/')} |")
    md += ["", "## תמלילים", ""]
    for r in results:
        md.append(f"### {r['id']}. {r['topic']}")
        for t in r["transcript"]:
            md.append(f"- **לקוחה:** {t['user']}")
            md.append("- **סוכנת:** " + " / ".join(t["agent"]))
        md.append("")
    (HERE / f"results-{stamp}.md").write_text("\n".join(md), encoding="utf-8")
    print(f"passed {sum(r['passed_text'] for r in results)}/{len(results)} · started_utc {started.isoformat()} · results-{stamp}.md")


asyncio.run(main())
