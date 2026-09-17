#!/usr/bin/env python3
"""Smoke-test the portfolio at desktop and mobile widths."""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

SITE_URL = os.environ.get("PORTFOLIO_SITE_URL", "https://kaushikkuberanathan.github.io/").rstrip("/") + "/"
DATA_URL = os.environ.get(
    "PORTFOLIO_ACTIVITY_URL",
    "https://raw.githubusercontent.com/kaushikkuberanathan/kaushikkuberanathan.github.io/activity-data/product-activity.json",
)
DEPLOY_WAIT_SECONDS = int(os.environ.get("PORTFOLIO_DEPLOY_WAIT_SECONDS", "300"))


@dataclass
class ViewportResult:
    width: int
    height: int
    active_tab: str
    northstar_length: int
    signal_length: int
    release_links: int
    release_titles: list[str]
    resume_filename: str
    resume_target: str | None
    document_overflow_px: int
    fallback_visible: bool
    console_errors: list[str]


def fetch_text(url: str, timeout: int = 30) -> tuple[int, str]:
    separator = "&" if "?" in url else "?"
    cache_busted = f"{url}{separator}smoke={int(time.time() * 1000)}"
    request = urllib.request.Request(
        cache_busted,
        headers={
            "Accept": "text/html,application/json,text/css,*/*",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "User-Agent": "portfolio-live-smoke/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, response.read().decode("utf-8", errors="replace")


def uses_commit_model(data: dict) -> bool:
    months = data.get("months", [])
    return len(months) == 6 and all(
        int(month.get("productImprovements", 0)) + int(month.get("qualityImprovements", 0))
        == int(month.get("developmentCommits", 0))
        for month in months
    )


def wait_for_live_deployment() -> dict:
    deadline = time.monotonic() + DEPLOY_WAIT_SECONDS
    last_error = "deployment not checked"

    while time.monotonic() < deadline:
        try:
            site_status, site_html = fetch_text(SITE_URL)
            js_status, activity_js = fetch_text(f"{SITE_URL}assets/product-activity.js")
            css_status, activity_css = fetch_text(f"{SITE_URL}assets/product-activity.css")
            favicon_status, _ = fetch_text(f"{SITE_URL}favicon.ico")
            data_status, data_text = fetch_text(DATA_URL)
            data = json.loads(data_text)

            deployed = all(
                [
                    site_status == 200,
                    js_status == 200,
                    css_status == 200,
                    favicon_status == 200,
                    data_status == 200,
                    "assets/product-activity.js" in site_html,
                    "installActivityTab" in activity_js,
                    "renderSignal" in activity_js,
                    "activity-northstar" in site_html,
                    ".activity-tab-panel" in activity_css,
                    data.get("schemaVersion") == 1,
                    uses_commit_model(data),
                    len(data.get("latestReleaseNotes", [])) >= 3,
                ]
            )
            if deployed:
                return {
                    "siteStatus": site_status,
                    "javascriptStatus": js_status,
                    "cssStatus": css_status,
                    "faviconStatus": favicon_status,
                    "dataStatus": data_status,
                    "generatedAt": data.get("generatedAt"),
                    "currentMonth": data.get("currentMonth", {}).get("label"),
                    "currentCommits": data.get("currentMonth", {}).get("developmentCommits"),
                    "releaseTitles": [note.get("title") for note in data.get("latestReleaseNotes", [])[:3]],
                }
            last_error = "live endpoints responded but did not contain the expected portfolio markers"
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as error:
            last_error = f"{type(error).__name__}: {error}"

        time.sleep(10)

    raise RuntimeError(f"Portfolio did not expose the expected experience within {DEPLOY_WAIT_SECONDS}s: {last_error}")


def make_driver(width: int, height: int) -> webdriver.Chrome:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument(f"--window-size={width},{height}")
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    return webdriver.Chrome(options=options)


def smoke_viewport(width: int, height: int) -> ViewportResult:
    driver = make_driver(width, height)
    try:
        smoke_url = f"{SITE_URL}?smoke={int(time.time() * 1000)}#tab-building"
        driver.get(smoke_url)
        wait = WebDriverWait(driver, 45)
        wait.until(EC.presence_of_element_located((By.ID, "tab-building")))
        wait.until(lambda browser: "active" in browser.find_element(By.ID, "panel-building").get_attribute("class").split())
        wait.until(lambda browser: not browser.find_element(By.CSS_SELECTOR, "[data-activity-content]").get_attribute("hidden"))
        wait.until(lambda browser: len(browser.find_elements(By.CSS_SELECTOR, ".activity-release-notes a")) >= 3)

        state = driver.execute_script(
            """
            const root = document.documentElement;
            const panel = document.getElementById('panel-building');
            const overview = document.getElementById('panel-overview');
            const status = panel.querySelector('[data-activity-status]');
            const content = panel.querySelector('[data-activity-content]');
            const northstar = panel.querySelector('.activity-northstar-copy');
            const signal = panel.querySelector('[data-activity-signal]');
            const activeButton = document.querySelector('.tab-button.active');
            const resumeLink = document.querySelector('a.social-link.resume');
            return {
              activeTab: activeButton ? activeButton.id : null,
              panelActive: panel.classList.contains('active'),
              overviewContainsActivity: Boolean(overview.querySelector('[data-product-activity]')),
              contentVisible: !content.hidden,
              fallbackVisible: !status.hidden,
              northstarLength: northstar ? northstar.textContent.trim().length : 0,
              signalLength: signal ? signal.textContent.trim().length : 0,
              releaseLinks: panel.querySelectorAll('.activity-release-notes a').length,
              releaseTitles: Array.from(panel.querySelectorAll('.activity-release-notes a')).map((link) => link.textContent.trim()),
              resumeFilename: resumeLink ? resumeLink.getAttribute('download') : null,
              resumeTarget: resumeLink ? resumeLink.getAttribute('target') : null,
              documentOverflowPx: Math.max(0, root.scrollWidth - root.clientWidth),
            };
            """
        )

        console_errors = [
            entry.get("message", "")
            for entry in driver.get_log("browser")
            if entry.get("level") == "SEVERE"
        ]

        failures: list[str] = []
        if state["activeTab"] != "tab-building" or not state["panelActive"]:
            failures.append("Building in Public tab did not activate from the URL hash")
        if state["overviewContainsActivity"]:
            failures.append("Activity dashboard still exists inside Overview")
        if not state["contentVisible"] or state["fallbackVisible"]:
            failures.append("Live activity content did not replace the fallback state")
        if state["northstarLength"] < 20:
            failures.append("North-star callout is missing or empty")
        if state["signalLength"] < 20:
            failures.append("Activity signal sentence is missing or empty")
        if state["releaseLinks"] < 3:
            failures.append(f"Expected at least 3 release-note links, found {state['releaseLinks']}")
        non_release_prefixes = ("story ", "story:", "feat ", "feat(", "feat:", "feature ", "feature:")
        if any(title.lower().startswith(non_release_prefixes) for title in state["releaseTitles"]):
            failures.append(f"Story/feature PR appeared in release notes: {state['releaseTitles']}")
        if state["resumeFilename"] is not None:
            failures.append(f"Resume link should not force a download: {state['resumeFilename']}")
        if state["resumeTarget"] != "_blank":
            failures.append(f"Resume link should open view-only in a new tab: {state['resumeTarget']}")
        if state["documentOverflowPx"] > 1:
            failures.append(f"Document overflows viewport by {state['documentOverflowPx']}px")
        if console_errors:
            failures.append(f"Browser console contains severe errors: {console_errors}")

        if failures:
            raise AssertionError("; ".join(failures))

        return ViewportResult(
            width=width,
            height=height,
            active_tab=state["activeTab"],
            northstar_length=state["northstarLength"],
            signal_length=state["signalLength"],
            release_links=state["releaseLinks"],
            release_titles=state["releaseTitles"],
            resume_filename=state["resumeFilename"],
            resume_target=state["resumeTarget"],
            document_overflow_px=state["documentOverflowPx"],
            fallback_visible=state["fallbackVisible"],
            console_errors=console_errors,
        )
    except TimeoutException as error:
        raise AssertionError(f"Timed out waiting for the portfolio dashboard at {width}x{height}") from error
    finally:
        driver.quit()


def main() -> int:
    endpoint_result = wait_for_live_deployment()
    mobile = smoke_viewport(390, 1400)
    desktop = smoke_viewport(1280, 900)

    print(
        json.dumps(
            {
                "endpoints": endpoint_result,
                "mobile": asdict(mobile),
                "desktop": asdict(desktop),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 - smoke test should emit one clear failure
        print(f"LIVE SMOKE FAILED: {type(error).__name__}: {error}", file=sys.stderr)
        raise
