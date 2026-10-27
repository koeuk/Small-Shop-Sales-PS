"""Exercise account management on the running local demo; remove the test account."""

import os
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright

BASE = "http://127.0.0.1:5173"
email = f"qa-{uuid4().hex[:8]}@example.com"


def sign_in(page, address, password):
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.get_by_label("Email address", exact=True).fill(address)
    page.get_by_label("Password", exact=True).fill(password)
    page.get_by_role("button", name="Sign in to your shop").click()
    expect(page.get_by_role("heading", name="Your shop, a little clearer.")).to_be_visible(timeout=15000)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    admin = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    admin.on("pageerror", lambda error: errors.append(str(error)))
    assert admin.request.get(f"{BASE}/api/config").json()["mode"] == "demo"
    sign_in(admin, os.getenv("BROWSER_ADMIN_EMAIL", "admin@smallshop.local"), os.getenv("BROWSER_ADMIN_PASSWORD", "shopdemo2026"))
    admin.get_by_role("navigation").get_by_role("link", name="Users", exact=True).click()
    admin.get_by_role("button", name="Add user", exact=True).click()
    modal = admin.get_by_role("dialog")
    modal.get_by_label("Full name", exact=True).fill("Browser test colleague")
    modal.get_by_label("Email address", exact=True).fill(email)
    modal.get_by_label("Temporary password", exact=True).fill("operator-initial-123")
    modal.get_by_role("button", name="Create user", exact=True).click()
    row = admin.get_by_role("row").filter(has_text=email)
    expect(row).to_contain_text("operator")
    row.get_by_role("button", name=f"Edit {email}", exact=True).click()
    modal.get_by_label("Full name", exact=True).fill("Updated colleague")
    modal.get_by_role("button", name="Save account", exact=True).click()
    expect(row).to_contain_text("Updated colleague")
    row.get_by_role("button", name=f"Reset password for {email}", exact=True).click()
    modal.get_by_label("New password", exact=True).fill("operator-reset-456")
    modal.get_by_label("Confirm password", exact=True).fill("operator-reset-456")
    modal.get_by_role("button", name="Show new password", exact=True).click()
    expect(modal.get_by_label("New password", exact=True)).to_have_attribute("type", "text")
    modal.get_by_role("button", name="Update password", exact=True).click()
    expect(modal).to_have_count(0)

    member = browser.new_page(viewport={"width": 390, "height": 844})
    member.on("pageerror", lambda error: errors.append(str(error)))
    sign_in(member, email, "operator-reset-456")
    assert member.get_by_role("link", name="Users", exact=True).count() == 0
    member.goto(f"{BASE}/training", wait_until="networkidle")
    expect(member.get_by_role("button", name="Retrain models", exact=True)).to_be_disabled()
    row.get_by_role("button", name=f"Deactivate {email}", exact=True).click()
    modal.get_by_role("button", name="Deactivate account", exact=True).click()
    expect(row).to_contain_text("Inactive")
    member.goto(f"{BASE}/sales", wait_until="networkidle")
    expect(member.get_by_role("heading", name="Welcome back.")).to_be_visible()

    row.get_by_role("button", name=f"Activate {email}", exact=True).click()
    modal.get_by_role("button", name="Activate account", exact=True).click()
    row.get_by_role("button", name=f"Edit {email}", exact=True).click()
    modal.get_by_label("Role", exact=True).select_option("administrator")
    modal.get_by_role("button", name="Save account", exact=True).click()
    expect(row).to_contain_text("administrator")
    sign_in(member, email, "operator-reset-456")
    member.goto(f"{BASE}/users", wait_until="networkidle")
    own_row = member.get_by_role("row").filter(has_text=email)
    own_row.get_by_role("button", name=f"Reset password for {email}", exact=True).click()
    member_modal = member.get_by_role("dialog")
    member_modal.get_by_label("New password", exact=True).fill("colleague-final-789")
    member_modal.get_by_label("Confirm password", exact=True).fill("colleague-final-789")
    member_modal.get_by_role("button", name="Update password", exact=True).click()
    expect(member.get_by_role("heading", name="Welcome back.")).to_be_visible()
    sign_in(member, email, "colleague-final-789")
    screenshots = Path(__file__).resolve().parents[1] / "docs/screenshots"
    notifications = admin.get_by_role("button", name="Dismiss notification")
    while notifications.count():
        notifications.first.click()
    admin.screenshot(path=str(screenshots / "users.png"), full_page=True)
    row.get_by_role("button", name=f"Delete {email}", exact=True).click()
    modal.get_by_role("button", name="Remove user", exact=True).click()
    expect(row).to_have_count(0)
    member.reload(wait_until="networkidle")
    expect(member.get_by_role("heading", name="Welcome back.")).to_be_visible()
    assert not errors, errors
    print("Users browser checks passed: create, edit, password eye/reset, operator permissions, deactivate/reactivate, role change, own-password logout, deletion and session revocation.")
    browser.close()
