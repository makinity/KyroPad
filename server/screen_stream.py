"""
screen_stream.py — High performance multi-monitor screen capture and touch mapping.

Uses direct Win32 GDI capture for 100% reliable multi-monitor support (including
negative coordinate secondary monitors) and fast JPEG compression.
"""

import io
import logging
import base64
import ctypes
from typing import List, Dict, Any, Tuple, Optional
from PIL import Image
from pynput.mouse import Button, Controller as MouseController

logger = logging.getLogger(__name__)

_mouse = MouseController()

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

# Set DPI awareness so multi-monitor coordinates match physical pixels
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    try:
        user32.SetProcessDPIAware()
    except Exception:
        pass


class RECT(ctypes.Structure):
    _fields_ = [
        ('left', ctypes.c_long),
        ('top', ctypes.c_long),
        ('right', ctypes.c_long),
        ('bottom', ctypes.c_long),
    ]


class MONITORINFOEX(ctypes.Structure):
    _fields_ = [
        ('cbSize', ctypes.c_ulong),
        ('rcMonitor', RECT),
        ('rcWork', RECT),
        ('dwFlags', ctypes.c_ulong),
        ('szDevice', ctypes.c_wchar * 32),
    ]


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ('biSize', ctypes.c_uint32),
        ('biWidth', ctypes.c_int32),
        ('biHeight', ctypes.c_int32),
        ('biPlanes', ctypes.c_uint16),
        ('biBitCount', ctypes.c_uint16),
        ('biCompression', ctypes.c_uint32),
        ('biSizeImage', ctypes.c_uint32),
        ('biXPelsPerMeter', ctypes.c_int32),
        ('biYPelsPerMeter', ctypes.c_int32),
        ('biClrUsed', ctypes.c_uint32),
        ('biClrImportant', ctypes.c_uint32),
    ]


def getMonitorsList() -> List[Dict[str, Any]]:
    """
    Get a structured list of all connected displays with absolute pixel offsets.
    """
    monitors: List[Dict[str, Any]] = []

    def callback(hMonitor, hdcMonitor, lprcMonitor, dwData):
        info = MONITORINFOEX()
        info.cbSize = ctypes.sizeof(MONITORINFOEX)
        if user32.GetMonitorInfoW(hMonitor, ctypes.byref(info)):
            r = info.rcMonitor
            idx = len(monitors) + 1
            is_primary = bool(info.dwFlags & 1)
            name = f"Display {idx} {'(Primary)' if is_primary else ''}".strip()
            monitors.append({
                "id": idx,
                "name": name,
                "device": info.szDevice,
                "left": int(r.left),
                "top": int(r.top),
                "width": int(r.right - r.left),
                "height": int(r.bottom - r.top),
                "is_primary": is_primary,
            })
        return 1

    MonitorEnumProc = ctypes.WINFUNCTYPE(
        ctypes.c_int,
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_void_p,
    )
    user32.EnumDisplayMonitors(None, None, MonitorEnumProc(callback), 0)

    if not monitors:
        w = user32.GetSystemMetrics(0)
        h = user32.GetSystemMetrics(1)
        monitors.append({
            "id": 1,
            "name": "Display 1 (Primary)",
            "device": "PRIMARY",
            "left": 0,
            "top": 0,
            "width": w,
            "height": h,
            "is_primary": True,
        })

    # Add 'All Displays' combined virtual screen option
    SM_XVIRTUALSCREEN = 76
    SM_YVIRTUALSCREEN = 77
    SM_CXVIRTUALSCREEN = 78
    SM_CYVIRTUALSCREEN = 79

    v_left = user32.GetSystemMetrics(SM_XVIRTUALSCREEN)
    v_top = user32.GetSystemMetrics(SM_YVIRTUALSCREEN)
    v_width = user32.GetSystemMetrics(SM_CXVIRTUALSCREEN)
    v_height = user32.GetSystemMetrics(SM_CYVIRTUALSCREEN)

    if len(monitors) > 1:
        monitors.insert(0, {
            "id": 0,
            "name": "All Displays (Combined)",
            "device": "VIRTUAL_ALL",
            "left": int(v_left),
            "top": int(v_top),
            "width": int(v_width),
            "height": int(v_height),
            "is_primary": False,
        })

    return monitors


def getMonitorBounds(monitor_id: int) -> Dict[str, Any]:
    """Get bounds for a specific monitor ID (0 for all, 1, 2, ...)."""
    monitors = getMonitorsList()
    for m in monitors:
        if m["id"] == monitor_id:
            return m
    for m in monitors:
        if m.get("is_primary"):
            return m
    return monitors[0] if monitors else {"left": 0, "top": 0, "width": 1920, "height": 1080}


class ScreenCapturer:
    """High-performance screen capture using Win32 GDI."""

    def captureFrameBase64(
        self,
        monitor_id: int = 2,
        max_width: int = 720,
        quality: int = 55,
    ) -> Optional[Tuple[str, int, int]]:
        """
        Capture a frame from the given monitor, compress to JPEG and encode to base64.
        Returns: (base64_jpeg_string, monitor_width, monitor_height)
        """
        try:
            bounds = getMonitorBounds(monitor_id)
            left = bounds["left"]
            top = bounds["top"]
            width = bounds["width"]
            height = bounds["height"]

            if width <= 0 or height <= 0:
                return None

            hwin = user32.GetDesktopWindow()
            hwindc = user32.GetDC(hwin)
            memdc = gdi32.CreateCompatibleDC(hwindc)

            bmp = gdi32.CreateCompatibleBitmap(hwindc, width, height)
            gdi32.SelectObject(memdc, bmp)

            # SRCCOPY = 0x00CC0020
            SRCCOPY = 0x00CC0020
            gdi32.BitBlt(memdc, 0, 0, width, height, hwindc, left, top, SRCCOPY)

            bmi = BITMAPINFOHEADER()
            bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
            bmi.biWidth = width
            bmi.biHeight = -height  # top-down DIB
            bmi.biPlanes = 1
            bmi.biBitCount = 32
            bmi.biCompression = 0

            buf = ctypes.create_string_buffer(width * height * 4)
            gdi32.GetDIBits(memdc, bmp, 0, height, buf, ctypes.byref(bmi), 0)

            # Clean up Win32 handles
            gdi32.DeleteObject(bmp)
            gdi32.DeleteDC(memdc)
            user32.ReleaseDC(hwin, hwindc)

            img = Image.frombuffer('RGBA', (width, height), buf, 'raw', 'BGRA', 0, 1).convert('RGB')

            # Scale down if requested to save bandwidth
            w, h = img.size
            if w > max_width:
                scale = max_width / float(w)
                new_size = (max_width, int(h * scale))
                img = img.resize(new_size, Image.Resampling.BILINEAR)

            out_buf = io.BytesIO()
            img.save(out_buf, format="JPEG", quality=quality, optimize=False)
            b64_str = base64.b64encode(out_buf.getvalue()).decode("ascii")

            return (f"data:image/jpeg;base64,{b64_str}", width, height)
        except Exception as exc:
            logger.warning("Screen capture error (monitor=%d): %s", monitor_id, exc)
            return None


# Global capturer instance
screenCapturer = ScreenCapturer()


# ---------------------------------------------------------------------------
# Touch coordinate mapping & interaction (Multi-Monitor Virtual Desktop Aware)
# ---------------------------------------------------------------------------

MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_ABSOLUTE = 0x8000
MOUSEEVENTF_VIRTUALDESK = 0x4000


def _sendVirtualDesktopMouseEvent(target_x: int, target_y: int, flags: int = 0) -> None:
    """
    Send mouse input mapped across the entire multi-monitor virtual desktop.
    Handles negative offsets and secondary monitors seamlessly.
    """
    SM_XVIRTUALSCREEN = 76
    SM_YVIRTUALSCREEN = 77
    SM_CXVIRTUALSCREEN = 78
    SM_CYVIRTUALSCREEN = 79

    v_left = user32.GetSystemMetrics(SM_XVIRTUALSCREEN)
    v_top = user32.GetSystemMetrics(SM_YVIRTUALSCREEN)
    v_w = user32.GetSystemMetrics(SM_CXVIRTUALSCREEN)
    v_h = user32.GetSystemMetrics(SM_CYVIRTUALSCREEN)

    # Position cursor directly using physical screen coordinates
    try:
        user32.SetCursorPos(int(target_x), int(target_y))
    except Exception:
        pass

    if v_w > 0 and v_h > 0:
        # Normalize target coordinates to 0..65535 across virtual desktop
        fx = int(((target_x - v_left) / float(v_w)) * 65535)
        fy = int(((target_y - v_top) / float(v_h)) * 65535)

        combined_flags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK | flags
        user32.mouse_event(combined_flags, fx, fy, 0, 0)
    elif flags:
        user32.mouse_event(flags, 0, 0, 0, 0)


def mapNormalizedTouch(monitor_id: int, norm_x: float, norm_y: float) -> Tuple[int, int]:
    """
    Map normalized coordinates (0.0 to 1.0) on a given monitor to absolute Windows pixel coordinates.
    """
    bounds = getMonitorBounds(monitor_id)
    clamped_x = max(0.0, min(1.0, float(norm_x)))
    clamped_y = max(0.0, min(1.0, float(norm_y)))

    target_x = int(bounds["left"] + clamped_x * bounds["width"])
    target_y = int(bounds["top"] + clamped_y * bounds["height"])
    return target_x, target_y


def touchClick(monitor_id: int, norm_x: float, norm_y: float, button: str = "left") -> None:
    """Move cursor to normalized coordinate and click."""
    try:
        x, y = mapNormalizedTouch(monitor_id, norm_x, norm_y)
        down_flag = MOUSEEVENTF_LEFTDOWN if button == "left" else MOUSEEVENTF_RIGHTDOWN
        up_flag = MOUSEEVENTF_LEFTUP if button == "left" else MOUSEEVENTF_RIGHTUP

        # Move and press down
        _sendVirtualDesktopMouseEvent(x, y, down_flag)
        # Release up
        _sendVirtualDesktopMouseEvent(x, y, up_flag)
    except Exception as exc:
        logger.warning("touchClick failed (monitor=%d): %s", monitor_id, exc)


def touchDoubleClick(monitor_id: int, norm_x: float, norm_y: float) -> None:
    """Move cursor to normalized coordinate and double click."""
    try:
        x, y = mapNormalizedTouch(monitor_id, norm_x, norm_y)
        # Click 1
        _sendVirtualDesktopMouseEvent(x, y, MOUSEEVENTF_LEFTDOWN)
        _sendVirtualDesktopMouseEvent(x, y, MOUSEEVENTF_LEFTUP)
        # Click 2
        _sendVirtualDesktopMouseEvent(x, y, MOUSEEVENTF_LEFTDOWN)
        _sendVirtualDesktopMouseEvent(x, y, MOUSEEVENTF_LEFTUP)
    except Exception as exc:
        logger.warning("touchDoubleClick failed: %s", exc)


def touchDown(monitor_id: int, norm_x: float, norm_y: float, button: str = "left") -> None:
    """Move cursor to normalized coordinate and press button down (for drag)."""
    try:
        x, y = mapNormalizedTouch(monitor_id, norm_x, norm_y)
        down_flag = MOUSEEVENTF_LEFTDOWN if button == "left" else MOUSEEVENTF_RIGHTDOWN
        _sendVirtualDesktopMouseEvent(x, y, down_flag)
    except Exception as exc:
        logger.warning("touchDown failed: %s", exc)


def touchMove(monitor_id: int, norm_x: float, norm_y: float) -> None:
    """Move cursor to normalized coordinate."""
    try:
        x, y = mapNormalizedTouch(monitor_id, norm_x, norm_y)
        _sendVirtualDesktopMouseEvent(x, y, 0)
    except Exception as exc:
        logger.warning("touchMove failed: %s", exc)


def touchUp(monitor_id: int, norm_x: float, norm_y: float, button: str = "left") -> None:
    """Move cursor and release button."""
    try:
        x, y = mapNormalizedTouch(monitor_id, norm_x, norm_y)
        up_flag = MOUSEEVENTF_LEFTUP if button == "left" else MOUSEEVENTF_RIGHTUP
        _sendVirtualDesktopMouseEvent(x, y, up_flag)
    except Exception as exc:
        logger.warning("touchUp failed: %s", exc)

