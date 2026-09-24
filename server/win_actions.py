"""
win_actions.py — Windows 11 input and system action handlers.

Separates all Win32 / pynput side effects from the WebSocket logic so
the server module stays focused on networking concerns.
"""

import ctypes
import logging
from pynput.mouse import Button, Controller as MouseController
from pynput.keyboard import Key, Controller as KeyboardController

logger = logging.getLogger(__name__)

# Module-level controller instances are reused across calls to avoid the
# overhead of creating new OS handles on every event.
_mouse = MouseController()
_keyboard = KeyboardController()


# ---------------------------------------------------------------------------
# Mouse
# ---------------------------------------------------------------------------

def moveMouse(dx: float, dy: float) -> None:
    """Move the mouse cursor by a relative offset (dx, dy)."""
    try:
        _mouse.move(dx, dy)
    except Exception as exc:
        # Log but never raise — a bad move event should not crash the server.
        logger.warning("moveMouse failed: %s", exc)


def mouseDown(button: str = "left") -> None:
    """
    Press and hold a mouse button down.

    Args:
        button: "left" or "right"
    """
    try:
        btn = Button.left if button == "left" else Button.right
        _mouse.press(btn)
    except Exception as exc:
        logger.warning("mouseDown failed (button=%s): %s", button, exc)


def mouseUp(button: str = "left") -> None:
    """
    Release a held mouse button.

    Args:
        button: "left" or "right"
    """
    try:
        btn = Button.left if button == "left" else Button.right
        _mouse.release(btn)
    except Exception as exc:
        logger.warning("mouseUp failed (button=%s): %s", button, exc)


def clickMouse(button: str) -> None:
    """
    Perform a single mouse click.

    Args:
        button: "left" or "right"
    """
    try:
        btn = Button.left if button == "left" else Button.right
        _mouse.click(btn)
    except Exception as exc:
        logger.warning("clickMouse failed (button=%s): %s", button, exc)


def doubleClickMouse() -> None:
    """Perform a double left click."""
    try:
        _mouse.click(Button.left, count=2)
    except Exception as exc:
        logger.warning("doubleClickMouse failed: %s", exc)


def scrollMouse(dy: int) -> None:
    """
    Scroll the mouse wheel vertically.

    Args:
        dy: Positive scrolls up, negative scrolls down (mirrors typical OS convention).
    """
    try:
        _mouse.scroll(0, dy)
    except Exception as exc:
        logger.warning("scrollMouse failed: %s", exc)


def zoomMouse(delta: int) -> None:
    """
    Zoom in/out by scrolling the mouse wheel with the Ctrl key held.

    Args:
        delta: Positive zooms in, negative zooms out.
    """
    try:
        with _keyboard.pressed(Key.ctrl):
            _mouse.scroll(0, delta)
    except Exception as exc:
        logger.warning("zoomMouse failed: %s", exc)


# ---------------------------------------------------------------------------
# Windows 11 window management hotkeys
# ---------------------------------------------------------------------------

def _pressHotkey(*keys) -> None:
    """
    Helper that presses all keys simultaneously then releases them.

    Using a context manager per key ensures correct press/release ordering
    even if an intermediate key press raises an exception.
    """
    try:
        for key in keys:
            _keyboard.press(key)
        for key in reversed(keys):
            _keyboard.release(key)
    except Exception as exc:
        logger.warning("_pressHotkey failed (keys=%s): %s", keys, exc)


def flingWindowRight() -> None:
    """Move the focused window to the next monitor (Win + Shift + Right)."""
    _pressHotkey(Key.cmd, Key.shift, Key.right)


def flingWindowLeft() -> None:
    """Move the focused window to the previous monitor (Win + Shift + Left)."""
    _pressHotkey(Key.cmd, Key.shift, Key.left)


def snapWindowLeft() -> None:
    """Snap the focused window to the left half (Win + Left)."""
    _pressHotkey(Key.cmd, Key.left)


def snapWindowRight() -> None:
    """Snap the focused window to the right half (Win + Right)."""
    _pressHotkey(Key.cmd, Key.right)


def snapWindowUp() -> None:
    """Maximize or snap the focused window upward (Win + Up)."""
    _pressHotkey(Key.cmd, Key.up)


def snapWindowDown() -> None:
    """Restore or snap the focused window downward (Win + Down)."""
    _pressHotkey(Key.cmd, Key.down)


def openTaskView() -> None:
    """Open Windows 11 Task View / virtual desktops (Win + Tab)."""
    _pressHotkey(Key.cmd, Key.tab)


def showDesktop() -> None:
    """Minimize/restore all windows to show desktop (Win + D)."""
    _pressHotkey(Key.cmd, 'd')


def switchDesktopLeft() -> None:
    """Switch to the previous virtual desktop (Ctrl + Win + Left)."""
    _pressHotkey(Key.ctrl, Key.cmd, Key.left)


def switchDesktopRight() -> None:
    """Switch to the next virtual desktop (Ctrl + Win + Right)."""
    _pressHotkey(Key.ctrl, Key.cmd, Key.right)


def altTab() -> None:
    """Switch between active windows (Alt + Tab)."""
    _pressHotkey(Key.alt, Key.tab)


# ---------------------------------------------------------------------------
# System controls
# ---------------------------------------------------------------------------

def lockWorkstation() -> None:
    """
    Lock the Windows workstation immediately.

    Uses ctypes directly because pynput does not expose a Lock hotkey.
    Win+L is intercepted by the system before pynput can simulate it,
    so calling LockWorkStation() via the Win32 API is the reliable approach.
    """
    try:
        result = ctypes.windll.user32.LockWorkStation()
        if not result:
            logger.warning("LockWorkStation() returned 0 — may have failed.")
    except AttributeError:
        # windll.user32 may not exist on non-Windows systems (e.g. CI runners).
        logger.error("LockWorkStation is only available on Windows.")
    except Exception as exc:
        logger.warning("lockWorkstation failed: %s", exc)


def toggleMute() -> None:
    """
    Toggle the system audio mute state.

    Sends the VK_VOLUME_MUTE virtual key (0xAD) via keybd_event because
    pynput does not expose media keys directly.
    """
    VK_VOLUME_MUTE = 0xAD
    KEYEVENTF_EXTENDEDKEY = 0x0001
    KEYEVENTF_KEYUP = 0x0002

    try:
        ctypes.windll.user32.keybd_event(VK_VOLUME_MUTE, 0, KEYEVENTF_EXTENDEDKEY, 0)
        ctypes.windll.user32.keybd_event(VK_VOLUME_MUTE, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0)
    except Exception as exc:
        logger.warning("toggleMute failed: %s", exc)


def volumeUp() -> None:
    """Increase system volume by one step."""
    VK_VOLUME_UP = 0xAF
    KEYEVENTF_EXTENDEDKEY = 0x0001
    KEYEVENTF_KEYUP = 0x0002

    try:
        ctypes.windll.user32.keybd_event(VK_VOLUME_UP, 0, KEYEVENTF_EXTENDEDKEY, 0)
        ctypes.windll.user32.keybd_event(VK_VOLUME_UP, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0)
    except Exception as exc:
        logger.warning("volumeUp failed: %s", exc)


def volumeDown() -> None:
    """Decrease system volume by one step."""
    VK_VOLUME_DOWN = 0xAE
    KEYEVENTF_EXTENDEDKEY = 0x0001
    KEYEVENTF_KEYUP = 0x0002

    try:
        ctypes.windll.user32.keybd_event(VK_VOLUME_DOWN, 0, KEYEVENTF_EXTENDEDKEY, 0)
        ctypes.windll.user32.keybd_event(VK_VOLUME_DOWN, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0)
    except Exception as exc:
        logger.warning("volumeDown failed: %s", exc)


# ---------------------------------------------------------------------------
# Keyboard input
# ---------------------------------------------------------------------------

# Map of friendly key names (sent from mobile) to pynput Key constants.
# Only special keys belong here — printable characters are typed directly.
SPECIAL_KEY_MAP: dict[str, Key] = {
    "enter":     Key.enter,
    "backspace": Key.backspace,
    "tab":       Key.tab,
    "escape":    Key.esc,
    "space":     Key.space,
    "delete":    Key.delete,
    "up":        Key.up,
    "down":      Key.down,
    "left":      Key.left,
    "right":     Key.right,
    "home":      Key.home,
    "end":       Key.end,
    "page_up":   Key.page_up,
    "page_down": Key.page_down,
    "ctrl_a":    None,  # handled specially below
    "ctrl_c":    None,
    "ctrl_v":    None,
    "ctrl_z":    None,
    "ctrl_x":    None,
}


def typeText(text: str) -> None:
    """
    Type a string of characters on the active window.

    pynput's type() handles Unicode correctly and is more reliable than
    simulating individual key presses for printable characters.

    Args:
        text: The string to type. Max length is capped to prevent abuse.
    """
    MAX_LENGTH = 500
    if not text:
        return

    # Truncate silently — a runaway payload should not freeze the PC.
    safe_text = text[:MAX_LENGTH]

    try:
        _keyboard.type(safe_text)
    except Exception as exc:
        logger.warning("typeText failed (text=%r): %s", safe_text, exc)


def pressKey(key: str) -> None:
    """
    Press and release a single special key or keyboard shortcut.

    Args:
        key: A key name from SPECIAL_KEY_MAP, e.g. "enter", "backspace".
             Ctrl combos like "ctrl_c" are also supported.
    """
    # Handle Ctrl+<letter> shortcuts explicitly.
    CTRL_COMBOS = {
        "ctrl_a": "a",
        "ctrl_c": "c",
        "ctrl_v": "v",
        "ctrl_z": "z",
        "ctrl_x": "x",
        "ctrl_y": "y",
        "ctrl_s": "s",
    }

    if key in CTRL_COMBOS:
        try:
            _pressHotkey(Key.ctrl, CTRL_COMBOS[key])
        except Exception as exc:
            logger.warning("pressKey ctrl combo failed (key=%s): %s", key, exc)
        return

    pynput_key = SPECIAL_KEY_MAP.get(key)
    if pynput_key is None:
        logger.warning("pressKey: unknown key name '%s'", key)
        return

    try:
        _keyboard.press(pynput_key)
        _keyboard.release(pynput_key)
    except Exception as exc:
        logger.warning("pressKey failed (key=%s): %s", key, exc)


# ---------------------------------------------------------------------------
# Action dispatcher — maps JSON action strings to handler functions
# ---------------------------------------------------------------------------

# Keeping the map here (rather than in main.py) means new actions only
# require changes in this file, preserving separation of concerns.
ACTION_HANDLERS: dict[str, callable] = {
    "window_fling_right":   flingWindowRight,
    "window_fling_left":    flingWindowLeft,
    "snap_left":            snapWindowLeft,
    "snap_right":           snapWindowRight,
    "snap_up":              snapWindowUp,
    "snap_down":            snapWindowDown,
    "task_view":            openTaskView,
    "show_desktop":         showDesktop,
    "switch_desktop_left":  switchDesktopLeft,
    "switch_desktop_right": switchDesktopRight,
    "alt_tab":              altTab,
    "lock_pc":              lockWorkstation,
    "volume_mute":          toggleMute,
    "volume_up":            volumeUp,
    "volume_down":          volumeDown,
}


def dispatchWinAction(action: str) -> bool:
    """
    Execute a named Windows action.

    Args:
        action: One of the keys in ACTION_HANDLERS.

    Returns:
        True if the action was found and called, False otherwise.
    """
    handler = ACTION_HANDLERS.get(action)
    if handler is None:
        logger.warning("Unknown win_action received: %s", action)
        return False

    handler()
    return True
