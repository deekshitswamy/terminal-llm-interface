#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path
import sys


GATEWAY_DIR = Path.home() / "Library/Application Support/terminal-chat/catgpt-gateway"
MANAGER_PATH = GATEWAY_DIR / "src/browser/manager.py"
FIRST_LOGIN_PATH = GATEWAY_DIR / "scripts/first_login.py"


OLD_HIDE_FUNCTION = '''def _hide_chrome_windows() -> None:
    """Hide/minimize Chrome on macOS so a non-headless session behaves like a background app."""
    if sys.platform != "darwin":
        return

    script = """
    tell application "Google Chrome"
      try
        set miniaturized of every window to true
        hide
      end try
    end tell
    """

    try:
      subprocess.run(["osascript", "-e", script], check=False, capture_output=True, timeout=5)
    except Exception:
      pass
'''

NEW_HIDE_FUNCTION = '''def _hide_chrome_windows() -> None:
    """Hide/minimize the automation browser on macOS without touching the user's Chrome windows."""
    if sys.platform != "darwin":
        return

    script = """
    tell application "System Events"
      repeat with procName in {"Chromium", "Google Chrome for Testing"}
        if exists process procName then
          try
            set visible of process procName to false
          end try
        end if
      end repeat
    end tell
    """

    try:
      subprocess.run(["osascript", "-e", script], check=False, capture_output=True, timeout=5)
    except Exception:
      pass
'''

OLD_LAUNCH_BLOCK = '''        try:
            self._context = await self._playwright.chromium.launch_persistent_context(
                channel="chrome", **launch_kwargs
            )
            log.info("Launched with real Chrome")
        except Exception:
            log.info("Real Chrome not found, using bundled Chromium")
            self._context = await self._playwright.chromium.launch_persistent_context(
                **launch_kwargs
            )
'''

NEW_LAUNCH_BLOCK = '''        self._context = await self._playwright.chromium.launch_persistent_context(
            **launch_kwargs
        )
        log.info("Launched with bundled Chromium")
'''

OLD_NAVIGATE_BLOCK = '''    async def navigate(self, url: str) -> None:
        """Navigate to a URL and wait for page load."""
        log.info(f"Navigating to {url}")
        await self.page.goto(url, wait_until="domcontentloaded")
        log.info("Page loaded")
'''

NEW_NAVIGATE_BLOCK = '''    async def navigate(self, url: str) -> None:
        """Navigate to a URL and wait for page load."""
        log.info(f"Navigating to {url}")
        await self.page.goto(url, wait_until="domcontentloaded")
        if not Config.HEADLESS and Config.HIDE_BROWSER_WINDOWS:
            _hide_chrome_windows()
        log.info("Page loaded")
'''

FIRST_LOGIN_CLOSE_MARKER = '''        print("  Browser closed.\\n")

        # Close the macOS Terminal window automatically after login is done
'''

FIRST_LOGIN_CLOSE_REPLACEMENT = '''        print("  Browser closed.\\n")

        if sys.platform == "darwin":
            import subprocess
            try:
                subprocess.run(
                    [
                        "osascript",
                        "-e",
                        'tell application "Google Chrome for Testing" to quit'
                    ],
                    check=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=5,
                )
            except Exception:
                pass

        # Close the macOS Terminal window automatically after login is done
'''


def patch_file(file_path: Path, replacements: list[tuple[str, str]]) -> bool:
    text = file_path.read_text()
    updated = text

    for old, new in replacements:
        if old in updated:
            updated = updated.replace(old, new)

    if updated == text:
        return False

    file_path.write_text(updated)
    return True


def apply_patch() -> int:
    if not MANAGER_PATH.exists():
      print(f"Gateway manager file not found: {MANAGER_PATH}", file=sys.stderr)
      return 1
    if not FIRST_LOGIN_PATH.exists():
      print(f"Gateway first-login file not found: {FIRST_LOGIN_PATH}", file=sys.stderr)
      return 1

    manager_changed = patch_file(MANAGER_PATH, [
        (OLD_HIDE_FUNCTION, NEW_HIDE_FUNCTION),
        (OLD_LAUNCH_BLOCK, NEW_LAUNCH_BLOCK),
        (OLD_NAVIGATE_BLOCK, NEW_NAVIGATE_BLOCK),
    ])

    first_login_changed = patch_file(FIRST_LOGIN_PATH, [
        (FIRST_LOGIN_CLOSE_MARKER, FIRST_LOGIN_CLOSE_REPLACEMENT),
    ])

    manager_text = MANAGER_PATH.read_text()
    first_login_text = FIRST_LOGIN_PATH.read_text()

    manager_ok = all(block in manager_text for block in [
        NEW_HIDE_FUNCTION,
        NEW_LAUNCH_BLOCK,
        NEW_NAVIGATE_BLOCK,
    ])
    first_login_ok = FIRST_LOGIN_CLOSE_REPLACEMENT in first_login_text

    if not manager_ok or not first_login_ok:
        print("ChatGPT gateway patch could not be applied cleanly.", file=sys.stderr)
        return 1

    if manager_changed or first_login_changed:
        print("Patched ChatGPT gateway runtime files.")
    else:
        print("ChatGPT gateway patch already applied.")
    return 0


if __name__ == "__main__":
    raise SystemExit(apply_patch())
