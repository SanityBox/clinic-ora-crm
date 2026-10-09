"""Opens a visible browser on the CRM login page. A person signs in by hand; the session is saved for the e2e run.

Usage: python login_once.py <base url> <state file>
Nothing is typed by this script: credentials never pass through code or logs.
"""
import asyncio, sys
from playwright.async_api import async_playwright

BASE, STATE = sys.argv[1].rstrip("/"), sys.argv[2]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        ctx = await browser.new_context(locale="he-IL")
        page = await ctx.new_page()
        await page.goto(f"{BASE}/login")
        print("Sign in in the window that opened. Waiting up to 5 minutes...", flush=True)
        await page.wait_for_url(lambda u: "/login" not in u, timeout=300_000)
        await page.wait_for_load_state("networkidle")
        await ctx.storage_state(path=STATE)
        print(f"saved session to {STATE}")
        await browser.close()


asyncio.run(main())
