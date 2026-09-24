"""
main.py — WinDeck Remote server entry point.

Responsibilities:
  - Asyncio WebSocket server on 0.0.0.0:8080
  - JSON message parsing and routing to win_actions handlers
  - System tray icon (pystray) for background operation
  - Clean shutdown on tray "Exit"
"""

import asyncio
import json
import logging
import threading
import sys
import io
from typing import Optional

import websockets
from PIL import Image, ImageDraw
import pystray

import win_actions

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("windeck.server")

# ---------------------------------------------------------------------------
# Configuration constants
# ---------------------------------------------------------------------------

HOST = "0.0.0.0"
PORT = 8080

import screen_stream

# ---------------------------------------------------------------------------
# WebSocket message handler
# ---------------------------------------------------------------------------

async def _screenStreamLoop(websocket, monitor_id: int, quality: int, fps: int) -> None:
    """Async background task that grabs and sends screen frames continuously."""
    interval = 1.0 / max(5, min(30, fps))
    logger.info("Starting screen stream for monitor %d @ %d FPS (quality=%d)", monitor_id, fps, quality)

    try:
        while True:
            frame_data = screen_stream.screenCapturer.captureFrameBase64(
                monitor_id=monitor_id,
                max_width=720 if quality <= 60 else 960,
                quality=quality,
            )
            if frame_data:
                b64_img, orig_w, orig_h = frame_data
                msg = json.dumps({
                    "type": "screen_frame",
                    "image": b64_img,
                    "monitor": monitor_id,
                    "width": orig_w,
                    "height": orig_h,
                })
                await websocket.send(msg)

            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        logger.info("Screen stream stopped for monitor %d", monitor_id)
    except Exception as exc:
        logger.warning("Screen stream loop error: %s", exc)


async def handleMessage(websocket) -> None:
    """
    Receive and route a single WebSocket message.

    Each connected client sends JSON payloads described in the protocol spec.
    Malformed messages are logged and silently dropped so one bad client
    cannot crash the server.
    """
    client_addr = websocket.remote_address
    logger.info("Client connected: %s", client_addr)

    # Track active stream task for this connection
    stream_task: Optional[asyncio.Task] = None

    try:
        async for raw in websocket:
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("Non-JSON message from %s: %r", client_addr, raw)
                continue

            msgType = payload.get("type")

            if msgType == "mouse_move":
                dx = float(payload.get("dx", 0))
                dy = float(payload.get("dy", 0))
                win_actions.moveMouse(dx, dy)

            elif msgType == "mouse_down":
                button = payload.get("button", "left")
                win_actions.mouseDown(button)

            elif msgType == "mouse_up":
                button = payload.get("button", "left")
                win_actions.mouseUp(button)

            elif msgType == "mouse_click":
                button = payload.get("button", "left")
                if button not in ("left", "right"):
                    logger.warning("Invalid button value from %s: %s", client_addr, button)
                    continue
                win_actions.clickMouse(button)

            elif msgType == "mouse_double_click":
                win_actions.doubleClickMouse()

            elif msgType == "mouse_scroll":
                dy = int(payload.get("dy", 0))
                win_actions.scrollMouse(dy)

            elif msgType == "mouse_zoom":
                delta = int(payload.get("delta", 0))
                win_actions.zoomMouse(delta)

            # ---------------------------------------------------------------
            # Screen Streaming & Touch Handlers
            # ---------------------------------------------------------------
            elif msgType == "get_monitors":
                monitors = screen_stream.getMonitorsList()
                await websocket.send(json.dumps({
                    "type": "monitors_list",
                    "monitors": monitors,
                }))

            elif msgType == "screen_stream_start":
                monitor_id = int(payload.get("monitor", 1))
                quality = int(payload.get("quality", 60))
                fps = int(payload.get("fps", 20))

                if stream_task and not stream_task.done():
                    stream_task.cancel()

                stream_task = asyncio.create_task(
                    _screenStreamLoop(websocket, monitor_id, quality, fps)
                )

            elif msgType == "screen_stream_stop":
                if stream_task and not stream_task.done():
                    stream_task.cancel()
                    stream_task = None

            elif msgType == "screen_touch_click":
                monitor_id = int(payload.get("monitor", 1))
                nx = float(payload.get("x", 0))
                ny = float(payload.get("y", 0))
                button = payload.get("button", "left")
                screen_stream.touchClick(monitor_id, nx, ny, button)

            elif msgType == "screen_touch_double_click":
                monitor_id = int(payload.get("monitor", 1))
                nx = float(payload.get("x", 0))
                ny = float(payload.get("y", 0))
                screen_stream.touchDoubleClick(monitor_id, nx, ny)

            elif msgType == "screen_touch_down":
                monitor_id = int(payload.get("monitor", 1))
                nx = float(payload.get("x", 0))
                ny = float(payload.get("y", 0))
                button = payload.get("button", "left")
                screen_stream.touchDown(monitor_id, nx, ny, button)

            elif msgType == "screen_touch_move":
                monitor_id = int(payload.get("monitor", 1))
                nx = float(payload.get("x", 0))
                ny = float(payload.get("y", 0))
                screen_stream.touchMove(monitor_id, nx, ny)

            elif msgType == "screen_touch_up":
                monitor_id = int(payload.get("monitor", 1))
                nx = float(payload.get("x", 0))
                ny = float(payload.get("y", 0))
                button = payload.get("button", "left")
                screen_stream.touchUp(monitor_id, nx, ny, button)

            elif msgType == "win_action":
                action = payload.get("action", "")
                success = win_actions.dispatchWinAction(action)
                if not success:
                    logger.warning("Unhandled win_action '%s' from %s", action, client_addr)

            elif msgType == "key_type":
                text = payload.get("text", "")
                if isinstance(text, str) and text:
                    win_actions.typeText(text)
                else:
                    logger.warning("key_type missing or invalid 'text' from %s", client_addr)

            elif msgType == "key_press":
                key = payload.get("key", "")
                if isinstance(key, str) and key:
                    win_actions.pressKey(key)
                else:
                    logger.warning("key_press missing or invalid 'key' from %s", client_addr)

            else:
                logger.warning("Unknown message type '%s' from %s", msgType, client_addr)

    except websockets.exceptions.ConnectionClosedOK:
        logger.info("Client disconnected cleanly: %s", client_addr)
    except websockets.exceptions.ConnectionClosedError as exc:
        logger.warning("Client connection lost unexpectedly (%s): %s", client_addr, exc)
    except Exception as exc:
        logger.error("Unexpected error handling client %s: %s", client_addr, exc)
    finally:
        if stream_task and not stream_task.done():
            stream_task.cancel()


# ---------------------------------------------------------------------------
# Server lifecycle
# ---------------------------------------------------------------------------

# Shared asyncio event — the tray "Exit" handler sets this to trigger shutdown.
_stopEvent: asyncio.Event | None = None


async def runServer() -> None:
    """Start the WebSocket server and block until the stop event is set."""
    global _stopEvent
    _stopEvent = asyncio.Event()

    logger.info("WinDeck Remote server starting on ws://%s:%d", HOST, PORT)

    async with websockets.serve(handleMessage, HOST, PORT):
        logger.info("Server ready. Waiting for connections...")
        await _stopEvent.wait()

    logger.info("Server shut down.")


def startEventLoop() -> None:
    """Run the asyncio event loop in the background thread."""
    asyncio.run(runServer())


# ---------------------------------------------------------------------------
# System tray icon
# ---------------------------------------------------------------------------

def _buildTrayIcon() -> Image.Image:
    """
    Generate a minimal 64×64 tray icon programmatically.

    Using Pillow avoids shipping an external .ico file, keeping the
    distribution self-contained.
    """
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Dark rounded-rectangle background
    draw.rounded_rectangle([4, 4, 60, 60], radius=12, fill=(30, 30, 30, 220))

    # Simple "K" lettermark in accent cyan
    draw.text((20, 16), "K", fill=(0, 180, 240, 255))

    return img


def _onTrayExit(icon, item) -> None:
    """
    Callback for the tray 'Exit' menu item.

    Signals the asyncio event loop to shut down, then stops the tray icon.
    """
    logger.info("Exit requested from system tray.")

    # Signal the running event loop from a different thread.
    if _stopEvent is not None:
        # get_event_loop is safe here because the asyncio thread already
        # created and set the running loop.
        loop = asyncio.get_event_loop()
        loop.call_soon_threadsafe(_stopEvent.set)

    icon.stop()


def startTrayIcon() -> None:
    """Create and run the system tray icon on the main thread."""
    trayImage = _buildTrayIcon()

    menu = pystray.Menu(
        pystray.MenuItem("KyroPad — Running", lambda: None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Exit", _onTrayExit),
    )

    icon = pystray.Icon(
        name="KyroPad",
        icon=trayImage,
        title="KyroPad",
        menu=menu,
    )

    icon.run()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Start the WebSocket server in a background daemon thread so it does not
    # block the main thread, which pystray requires to own the tray icon on
    # Windows.
    serverThread = threading.Thread(target=startEventLoop, daemon=True, name="ws-server")
    serverThread.start()

    # The tray icon blocks the main thread until the user clicks Exit.
    startTrayIcon()

    # After the tray exits, give the server thread a moment to finish cleanly.
    serverThread.join(timeout=3)
    logger.info("WinDeck Remote exited.")
    sys.exit(0)
