#!/usr/bin/env python3
"""Smoke-test the deployed GitHub Pages portfolio at desktop and mobile widths."""

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
    "https://raw.githubusercontent.com/kaushikkuberanathan/lineup_generator/activity-data/product-activity.json",
)
DEPLOY_WAIT_SECONDS = int(os.environ.get("PORTFOLIO_DEPLOY_WAIT_SECONDS", "300"))
EXPECT_COMMIT_CENTRIC = os.environ.get("PORTFOLIO_EXPECT_COMMIT_CENTRIC", "false").lower() == "true"
EXPECTED_METRIC_LABELS = [
    "Committed improvements",
    "Product improvements",
    "Quality & delivery",
    "Production releases",
]
EXPECTED_TABLE_HEADERS = ["Month", "Commits", "Product", "Quality & delivery", "Releases"]


@dataclass
class ViewportResult:
    width: int
    height: int
    active_tab: str
    metric_count: int
    metric_labels: list[str]
    metric_values: list[int]
    table_headers: list[str]
    month_rows: int
    release_links: int
    release_titles: list[str]
    document_overflow_px: int
    table_scrollable: bool
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
            current = data.get("currentMonth", {})
            commits_reconcile = (
                current.get("developmentCommits")
                == current.get("productImprovements", 0) + current.get("qualityImprovements", 0)
            )

            required_markers = [
                site_status == 200,
                js_status == 200,
                css_status == 200,
                favicon_status == 200,
                data_status == 200,
                "assets/product-activity.js" in site_html,
                "installActivityTab" in activity_js,
                "Latest release notes" in activity_js,
                ".activity-tab-panel" in activity_css,
                data.get("schemaVersion") == 1,
                len(data.get("latestReleaseNotes", [])) >= 3,
            ]
            if EXPECT_COMMIT_CENTRIC:
                required_markers.extend(["Committed improvements" in activity_js, commits_reconcile])

            if all(required_markers):
                return {
                    "siteStatus": site_status,
                    "javascriptStatus": js_status,
                    "cssStatus": css_status,
                    "faviconStatus": favicon_status,
                    "dataStatus": data_status,
                    "commitCentricRequired": EXPECT_COMMIT_CENTRIC,
                    "generatedAt": data.get("generatedAt"),
                    "currentMonth": current.get("label"),
                    "committedImprovements": current.get("developmentCommits"),
                    "productImprovements": current.get("productImprovements"),
                    "qualityAndDelivery": current.get("qualityImprovements"),
                    "productionReleases": current.get("productionReleases"),
                    "releaseTitles": [note.get("title") for note in data.get("latestReleaseNotes", [])[:3]],
                }
            last_error = "live endpoints responded but did not contain the required tab/feed markers"
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as error:
            last_error = f"{type(error).__name__}: {error}"

        time.sleep(10)

    raise RuntimeError(f"GitHub Pages did not expose the required portfolio within {DEPLOY_WAIT_SECONDS}s: {last_error}")


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
            const tableWrap = panel.querySelector('.activity-table-wrap');
            const activeButton = document.querySelector('.tab-button.active');
            return {
              activeTab: activeButton ? activeButton.id : null,
              panelActive: panel.classList.contains('active'),
              overviewContainsActivity: Boolean(overview.querySelector('[data-product-activity]')),
              contentVisible: !content.hidden,
              fallbackVisible: !status.hidden,
              metricCount: panel.querySelectorAll('.activity-metric').length,
              metricLabels: Array.from(panel.querySelectorAll('.activity-metric-label')).map((item) => item.textContent.trim()),
              metricValues: Array.from(panel.querySelectorAll('.activity-metric-value')).map((item) => Number(item.textContent.trim())),
              tableHeaders: Array.from(panel.querySelectorAll('.activity-table thead th')).map((item) => item.textContent.trim()),
              monthRows: panel.querySelectorAll('.activity-table tbody tr').length,
              releaseLinks: panel.querySelectorAll('.activity-release-notes a').length,
              releaseTitles: Array.from(panel.querySelectorAll('.activity-release-notes a')).map((link) => link.textContent.trim()),
              documentOverflowPx: Math.max(0, root.scrollWidth - root.clientWidth),
              tableScrollable: tableWrap ? tableWrap.scrollWidth > tableWrap.clientWidth : false,
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
        if state["metricCount"] != 4:
            failures.append(f"Expected 4 metric cards, found {state['metricCount']}")
        if EXPECT_COMMIT_CENTRIC:
            if state["metricLabels"] != EXPECTED_METRIC_LABELS:
                failures.append(f"Unexpected metric labels: {state['metricLabels']}")
            if len(state["metricValues"]) == 4 and state["metricValues"][0] != state["metricValues"][1] + state["metricValues"][2]:
                failures.append(f"Committed improvements do not reconcile: {state['metricValues']}")
            if state["tableHeaders"] != EXPECTED_TABLE_HEADERS:
                failures.append(f"Unexpected table headers: {state['tableHeaders']}")
        if state["monthRows"] != 6:
            failures.append(f"Expected 6 monthly table rows, found {state['monthRows']}")
        if state["releaseLinks"] < 3:
            failures.append(f"Expected at least 3 release-note links, found {state['releaseLinks']}")
        if any("story" in title.lower() or title.lower().startswith("feat") for title in state["releaseTitles"]):
            failures.append(f"Story/feature PR appeared in release notes: {state['releaseTitles']}")
        if state["documentOverflowPx"] > 1:
            failures.append(f"Document overflows viewport by {state['documentOverflowPx']}px")
        if width <= 620 and not state["tableScrollable"]:
            failures.append("Mobile activity table is not contained in its own horizontal scroller")
        if console_errors:
            failures.append(f"Browser console contains severe errors: {console_errors}")

        if failures:
            raise AssertionError("; ".join(failures))

        return ViewportResult(
            width=width,
            height=height,
            active_tab=state["activeTab"],
            metric_count=state["metricCount"],
            metric_labels=state["metricLabels"],
            metric_values=state["metricValues"],
            table_headers=state["tableHeaders"],
            month_rows=state["monthRows"],
            release_links=state["releaseLinks"],
            release_titles=state["releaseTitles"],
            document_overflow_px=state["documentOverflowPx"],
            table_scrollable=state["tableScrollable"],
            fallback_visible=state["fallbackVisible"],
            console_errors=console_errors,
        )
    except TimeoutException as error:
        raise AssertionError(f"Timed out waiting for the live dashboard at {width}x{height}") from error
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
