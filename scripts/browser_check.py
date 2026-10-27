"""End-to-end check against a running local demo, using real API/database data.

Run on a fresh demo database. This deliberately loads synthetic sales and leaves
them in place for inspection. Start the two servers before running this script.
"""

from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / "docs/screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, timezone_id="Asia/Phnom_Penh")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:5173", wait_until="networkidle")
    expect(page.get_by_role("heading", name="Welcome back.")).to_be_visible()
    page.screenshot(path=str(SCREENSHOTS / "login.png"), full_page=True)
    page.get_by_role("button", name="Fill demo credentials").click()
    page.get_by_role("button", name="Sign in to your shop").click()
    expect(page.get_by_role("heading", name="Your shop, a little clearer.")).to_be_visible()
    seed = page.get_by_role("button", name="Load sample data")
    if seed.is_visible():
        seed.click()
    expect(page.get_by_text("180 days", exact=False).first).to_be_visible(timeout=15000)
    page.wait_for_load_state("networkidle")

    navigation = page.get_by_role("navigation", name="Main navigation")
    navigation.get_by_role("link", name="Products", exact=True).click()
    page.get_by_role("button", name="Add product", exact=True).click()
    modal = page.get_by_role("dialog")
    modal.get_by_label("Product name").fill("Browser test scone")
    modal.get_by_label("Category").fill("Bakery")
    modal.get_by_label("Price (USD)").fill("4.25")
    modal.get_by_role("button", name="Create product").click()
    expect(page.get_by_role("cell", name="Browser test scone", exact=True)).to_be_visible()
    page.get_by_role("button", name="Edit Browser test scone", exact=True).click()
    modal.get_by_label("Price (USD)").fill("4.50")
    modal.get_by_role("button", name="Save changes").click()
    expect(page.get_by_role("row").filter(has_text="Browser test scone")).to_contain_text("$4.50")

    navigation.get_by_role("link", name="Sales records", exact=True).click()
    page.get_by_role("button", name="Add a sale", exact=True).click()
    modal.get_by_label("Product", exact=True).select_option(label="Browser test scone")
    modal.get_by_label("Quantity", exact=True).fill("3")
    modal.get_by_label("Sale price (USD)").fill("2.00")
    modal.get_by_role("button", name="Record sale").click()
    sale_row = page.get_by_role("row").filter(has_text="Browser test scone")
    expect(sale_row).to_contain_text("$6.00")
    sale_row.get_by_role("button", name="Edit sale", exact=False).click()
    modal.get_by_label("Quantity", exact=True).fill("4")
    modal.get_by_role("button", name="Save changes").click()
    expect(sale_row).to_contain_text("$8.00")
    sale_row.get_by_role("button", name="Delete sale", exact=False).click()
    modal.get_by_role("button", name="Delete sale", exact=True).click()
    expect(sale_row).to_have_count(0)

    navigation.get_by_role("link", name="Import data", exact=True).click()
    date = datetime.now(ZoneInfo("Asia/Phnom_Penh")).date().isoformat()
    content = f"sale_date,product_name,quantity,unit_price\n{date},Browser test scone,2,4.50\n{date},Browser test scone,-1,4.50\n"
    page.get_by_label("Choose sales file").set_input_files({"name": "browser-check.csv", "mimeType": "text/csv", "buffer": content.encode()})
    page.get_by_role("checkbox", name="This file contains synthetic").check()
    page.get_by_role("button", name="Preview & validate").click()
    expect(page.get_by_role("heading", name="Your import preview")).to_be_visible()
    expect(page.get_by_role("button", name="Import 1 valid rows")).to_be_enabled()
    page.screenshot(path=str(SCREENSHOTS / "imports.png"), full_page=True)
    page.get_by_role("button", name="Import 1 valid rows").click()
    expect(page.get_by_text("browser-check.csv", exact=True)).to_be_visible()

    navigation.get_by_role("link", name="Model training", exact=True).click()
    page.get_by_role("button", name="Train models", exact=True).click()
    expect(page.get_by_role("button", name="Retrain models", exact=True)).to_be_enabled(timeout=30000)
    expect(page.get_by_text("Recommended", exact=True)).to_be_visible()
    page.wait_for_load_state("networkidle")
    page.screenshot(path=str(SCREENSHOTS / "training.png"), full_page=True)

    navigation.get_by_role("link", name="Forecasts", exact=False).click()
    page.get_by_role("button", name="Generate 7-day forecast").click()
    expect(page.get_by_role("heading", name="A little glimpse of the week.")).to_be_visible(timeout=15000)
    expect(page.locator(".forecast-day")).to_have_count(7)
    with page.expect_download() as info:
        page.get_by_role("button", name="Export CSV").click()
    download = info.value
    assert download.suggested_filename.endswith(".csv")
    assert len(Path(download.path()).read_text().splitlines()) == 8
    page.wait_for_load_state("networkidle")
    page.screenshot(path=str(SCREENSHOTS / "forecasts.png"), full_page=True)

    navigation.get_by_role("link", name="Overview", exact=True).click()
    page.wait_for_load_state("networkidle")
    expect(page.locator(".forecast-amount")).not_to_contain_text("What comes next?")
    page.screenshot(path=str(SCREENSHOTS / "dashboard.png"), full_page=True)
    page.reload(wait_until="networkidle")
    expect(page.get_by_role("heading", name="Your shop, a little clearer.")).to_be_visible()

    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_load_state("networkidle")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Mobile page overflows horizontally"
    page.screenshot(path=str(SCREENSHOTS / "mobile-dashboard.png"), full_page=True)
    page.get_by_role("button", name="Open navigation").click()
    navigation.get_by_role("link", name="Forecasts", exact=False).click()
    expect(page.get_by_role("heading", name="Make room for what’s next.")).to_be_visible()
    expect(page.get_by_role("button", name="Open navigation")).to_have_attribute("aria-expanded", "false")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Mobile forecast page overflows horizontally"
    page.screenshot(path=str(SCREENSHOTS / "mobile-forecasts.png"), full_page=True)
    page.get_by_role("button", name="Open navigation").click()
    page.get_by_role("button", name="Shop administrator").click()
    expect(page.get_by_role("heading", name="Welcome back.")).to_be_visible()
    assert not errors, f"Browser JavaScript errors: {errors}"
    browser.close()
    print("Browser checks passed: sign-in, sample dataset, product/sales CRUD, import preview/commit, training, 7-day forecast, CSV export, persistence, mobile layout/navigation, sign-out.")
