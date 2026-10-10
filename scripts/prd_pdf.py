"""Builds docs/PRD.pdf from docs/PRD.md: Hebrew RTL, tables, and the Mermaid diagrams rendered.

Usage: python scripts/prd_pdf.py
Markdown and Mermaid are rendered in the browser (marked + mermaid from a CDN), so there is no extra Python dependency;
Playwright prints the page to PDF.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "docs" / "PRD.md", ROOT / "docs" / "PRD.pdf"
REPO_DOCS = "https://github.com/SanityBox/clinic-ora-crm/blob/main/docs/"

HTML = """<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: Heebo, Arial, sans-serif; font-size: 10.5pt; line-height: 1.55; color: #2B2326; }
  h1 { color: #8E4A5E; font-size: 22pt; margin: 0 0 8pt; }
  h2 { color: #8E4A5E; font-size: 15pt; border-bottom: 2px solid #EDE4E7; padding-bottom: 3pt; margin-top: 18pt; break-after: avoid; }
  h3 { font-size: 12pt; margin-top: 12pt; break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 9.5pt; }
  th, td { border: 1px solid #D9CDD1; padding: 3pt 5pt; text-align: right; vertical-align: top; }
  th { background: #EDE4E7; }
  tr { break-inside: avoid; }
  code { direction: ltr; unicode-bidi: isolate; background: #F4EEF0; padding: 0 3px; border-radius: 3px; font-size: 9pt; }
  pre code { display: block; padding: 6pt; white-space: pre-wrap; }
  blockquote { margin: 6pt 0; padding: 4pt 10pt; border-inline-start: 3px solid #8E4A5E; background: #FAF7F4; }
  .mermaid { direction: ltr; text-align: center; margin: 8pt 0; break-inside: avoid; }
  .mermaid svg { max-width: 100%; max-height: 235mm; height: auto; }
  hr { border: 0; border-top: 1px solid #EDE4E7; }
  a { color: #8E4A5E; }
</style></head><body><main id="doc"></main>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
<script>
  const md = __MD__, base = __BASE__;
  const slug = t => t.trim().toLowerCase().replace(/[^\\p{L}\\p{N}\\s-]/gu, '').replace(/\\s/g, '-');
  const r = new marked.Renderer();
  r.code = (code, lang) => lang === 'mermaid'
    ? `<div class="mermaid">${code.replace(/</g, '&lt;')}</div>`
    : `<pre><code>${code.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre>`;
  r.heading = (text, level, raw) => `<h${level} id="${slug(raw)}">${text}</h${level}>`;
  r.link = (href, title, text) => {
    if (href && !/^(https?:|#|mailto:)/.test(href)) href = base + href;
    return `<a href="${href}">${text}</a>`;
  };
  document.getElementById('doc').innerHTML = marked.parse(md, { renderer: r, gfm: true });
  // SVG text labels: HTML labels measure Hebrew before the web font loads and clip the first letter
  mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'Heebo, Arial', flowchart: { htmlLabels: false } });
  document.fonts.ready.then(() => mermaid.run({ querySelector: '.mermaid' })).then(() => { window.__ready = true; },
    e => { window.__ready = true; window.__err = String(e); });
</script></body></html>"""


async def main():
    md = SRC.read_text(encoding="utf-8")
    html = HTML.replace("__MD__", json.dumps(md, ensure_ascii=False)).replace("__BASE__", json.dumps(REPO_DOCS))
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(html, wait_until="networkidle")
        await page.wait_for_function("window.__ready === true", timeout=60000)
        err = await page.evaluate("window.__err || null")
        diagrams = await page.evaluate("document.querySelectorAll('.mermaid svg').length")
        await page.pdf(path=str(OUT), format="A4", print_background=True,
                       margin={"top": "16mm", "bottom": "16mm", "left": "14mm", "right": "14mm"})
        await page.close()
        await browser.close()
    print(f"{OUT.name}: {OUT.stat().st_size // 1024} KB, diagrams rendered: {diagrams}" + (f", mermaid error: {err}" if err else ""))


asyncio.run(main())
