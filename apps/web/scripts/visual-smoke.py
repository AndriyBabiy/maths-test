"""
Visual smoke test for Math Notebook routes.
Captures screenshots at desktop / laptop / tablet viewports so we can spot
clipping, broken layouts, and stale cache issues.
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / "scripts" / "_visual"
OUT.mkdir(parents=True, exist_ok=True)

ROUTES = [
    ("home", "/"),
    ("assessment", "/assessment"),
    ("smoke", "/assessment/smoke"),
]

VIEWPORTS = [
    ("4k", 2560, 1440),
    ("desktop", 1440, 900),
    ("laptop", 1280, 800),
]


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for vname, w, h in VIEWPORTS:
            ctx = browser.new_context(viewport={"width": w, "height": h})
            page = ctx.new_page()
            for rname, path in ROUTES:
                url = f"{base}{path}"
                try:
                    resp = page.goto(url, wait_until="networkidle", timeout=30_000)
                    status = resp.status if resp else "?"
                except Exception as exc:
                    print(f"[{vname}] {path} → ERROR {exc}")
                    continue
                page.wait_for_timeout(800)  # let API call resolve
                shot = OUT / f"{vname}_{rname}.png"
                page.screenshot(path=str(shot), full_page=False)
                print(f"[{vname}] {path} → {status}  saved {shot.name}")
            ctx.close()
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
