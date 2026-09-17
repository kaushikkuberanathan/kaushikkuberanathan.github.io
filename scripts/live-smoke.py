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
DEPLOY_WAIT_SECONDS = int(os.environ.get("PORTFOLIO_DEPLOY_WAIT_SECONDS", "300"))


@dataclass
class ViewportResult:
    width: int
    height: int
    active_tab: str
    resume_filename: str
    resume_target: str | None
    document_overflow_px: int
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
            css_status, _ = fetch_text(f"{SITE_URL}assets/confidential-gate.css")
            favicon_status, _ = fetch_text(f"{SITE_URL}favicon.ico")

            deployed = all(
                [
                    site_status == 200,
                    css_status == 200,
                    favicon_status == 200,
                    "assets/confidential-gate.js" in site_html,
                    'id="tab-overview"' in site_html,
                ]
            )
            if deployed:
                return {
                    "siteStatus": site_status,
                    "cssStatus": css_status,
                    "faviconStatus": favicon_status,
                }
            last_error = "live endpoints responded but did not contain the expected portfolio markers"
        except (urllib.error.URLError, TimeoutError, OSError) as error:
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
    driver = webdriver.Chrome(options=options)
    # --window-size sets the outer browser window, not the CSS viewport --
    # the gap between the two varies by platform/Chrome build and produces
    # false-positive overflow readings. Force the exact viewport via CDP.
    driver.execute_cdp_cmd(
        "Emulation.setDeviceMetricsOverride",
        {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": width < 768},
    )
    return driver


def smoke_viewport(width: int, height: int) -> ViewportResult:
    driver = make_driver(width, height)
    try:
        smoke_url = f"{SITE_URL}?smoke={int(time.time() * 1000)}#tab-experience"
        driver.get(smoke_url)
        wait = WebDriverWait(driver, 45)
        wait.until(EC.presence_of_element_located((By.ID, "tab-experience")))
        wait.until(lambda browser: "active" in browser.find_element(By.ID, "panel-experience").get_attribute("class").split())

        state = driver.execute_script(
            """
            const root = document.documentElement;
            const activeButton = document.querySelector('.tab-button.active');
            const panel = document.getElementById('panel-experience');
            const resumeLink = document.querySelector('a.social-link.resume');
            return {
              activeTab: activeButton ? activeButton.id : null,
              panelActive: panel.classList.contains('active'),
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
        if state["activeTab"] != "tab-experience" or not state["panelActive"]:
            failures.append("Experience tab did not activate from the URL hash")
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
            resume_filename=state["resumeFilename"],
            resume_target=state["resumeTarget"],
            document_overflow_px=state["documentOverflowPx"],
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
