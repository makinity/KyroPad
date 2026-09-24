<div align="center">

# 🎮 KyroPad

### *The Ultimate Wireless Precision Trackpad, Multi-Monitor Remote Screen & Macro Deck for Windows 11.*

[![Platform](https://img.shields.io/badge/Platform-Windows%2011-0078D4?style=for-the-badge&logo=windows11&logoColor=white)](https://microsoft.com/windows)
[![Mobile](https://img.shields.io/badge/Mobile-iOS%20%7C%20Android-107C10?style=for-the-badge&logo=apple&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/Client-React%20Native%20%2F%20Expo-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev)
[![Python](https://img.shields.io/badge/Server-Python%203.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-F7B500?style=for-the-badge)](LICENSE)

<br />

**KyroPad** turns your smartphone into a sleek, low-latency wireless trackpad with physical laptop ballistics, a real-time multi-monitor remote screen viewer with direct touch-to-click controls, and a customizable Windows 11 productivity macro deck.

[Features](#-key-features) • [Gesture Guide](#-precision-gesture-guide) • [Multi-Monitor](#-dual--multi-monitor-streaming) • [Quickstart](#-quickstart-guide) • [Protocol](#-protocol-reference)

---

</div>

<br />

## 🌟 Key Features

<table>
  <tr>
    <td width="50%">
      <h3>🖱️ Hardware-Grade Trackpad</h3>
      <ul>
        <li><b>1-Finger Move & Tap:</b> Silky smooth relative cursor tracking.</li>
        <li><b>Double-Tap & Hold:</b> Native tap-to-drag for moving windows, highlighting text, or dragging files.</li>
        <li><b>2-Finger Pinch:</b> Smooth <code>Ctrl + Wheel</code> zoom in/out for browsers, documents, and creative software.</li>
        <li><b>3-Finger Desktop Gestures:</b> Swipe up for <i>Task View</i>, swipe down for <i>Show Desktop</i>, swipe left/right for <i>Virtual Desktops</i>.</li>
        <li><b>Haptic Feedback:</b> Subtle mechanical tactile vibration pulses.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🖥️ Live Multi-Monitor Mirroring</h3>
      <ul>
        <li><b>20–25+ FPS Stream:</b> Real-time desktop streaming over local Wi-Fi with sub-10ms latency.</li>
        <li><b>Direct Touch-to-Click:</b> Tap directly on any icon, window, or button on your phone screen to click it on your PC.</li>
        <li><b>Instant Display Switcher:</b> Switch between <b>Display 1</b>, <b>Display 2</b>, or <b>All Displays combined</b> with one tap.</li>
        <li><b>Quick-Type Bar:</b> Floating virtual keyboard to type text directly into whatever window is on your screen.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🎛️ Windows 11 Macro Deck</h3>
      <ul>
        <li><b>Window Snapping:</b> Snap windows left, right, maximize, or fling windows between multi-monitor displays.</li>
        <li><b>System Controls:</b> Quick volume up/down, mute toggle, Task View, and instant Workstation Lock.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>⌨️ Remote Keyboard & Shortcuts</h3>
      <ul>
        <li><b>Text Broadcaster:</b> Type long strings or passwords and send them to Windows in milliseconds.</li>
        <li><b>Special Hotkeys:</b> Quick buttons for <code>Ctrl+C</code>, <code>Ctrl+V</code>, <code>Ctrl+Z</code>, <code>Ctrl+A</code>, <code>Enter</code>, <code>Backspace</code>, <code>Tab</code>, and <code>Esc</code>.</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🖐️ Precision Gesture Guide

KyroPad’s trackpad strictly replicates the **Windows Precision Touchpad** state machine:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GESTURE INTERACTION MAP                         │
├───────────────────────────────┬────────────────────────────────────────┤
│ 👆 1-Finger Slide             │ Relative Pointer Movement (Δx, Δy)     │
│ 👆 1-Finger Quick Tap         │ Left Click                             │
│ 👆👆 1-Finger Double-Tap      │ Double Left Click                      │
│ 👆👆 Hold & Slide             │ Tap-to-Drag (Window move / text select)│
│ ✌️ 2-Finger Tap               │ Right Click (Context Menu)             │
│ ✌️ 2-Finger Vertical Slide    │ Smooth Mouse Wheel Scroll              │
│ 🤏 2-Finger Pinch / Spread    │ Universal Zoom In / Out                │
│ 🖖 3-Finger Swipe Up          │ Task View / Virtual Desktops (Win+Tab) │
│ 🖖 3-Finger Swipe Down        │ Show Desktop / Minimize All (Win+D)    │
│ 🖖 3-Finger Swipe Left / Right│ Switch Virtual Desktops (Ctrl+Win+←/→) │
└───────────────────────────────┴────────────────────────────────────────┘
```

---

## 🖥️ Dual & Multi-Monitor Streaming

KyroPad features built-in multi-monitor coordinate translation, handling non-standard monitor arrangements (e.g. secondary monitors positioned to the left with negative coordinates like `-1920px`).

```
                      ┌────────────────────────┐
                      │    Windows 11 PC       │
                      │  (Win32 GDI Streamer)  │
                      └───────────┬────────────┘
                                  │
                 (Low-Latency Local Wi-Fi WebSocket)
                                  │
                                  ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │                       KyroPad Mobile App                         │
 │                                                                  │
 │   [ Display 1 (Left) ]   [ ★ Display 2 (Main) ]   [ All Screens ]│
 │  ┌────────────────────────────────────────────────────────────┐  │
 │  │                                                            │  │
 │  │                  Live Screen Video Mirror                  │  │
 │  │                                                            │  │
 │  │    • Tap folder on phone  ──> Clicks exact spot on PC      │  │
 │  │    • 2-finger scroll      ──> Scrolls active webpage       │  │
 │  │                                                            │  │
 │  └────────────────────────────────────────────────────────────┘  │
 │  [ ⌨️ Quick Keyboard ]   [ ⚡ FAST / HD Mode ]   [ 🔄 Refresh ]    │
 └──────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quickstart Guide

### 1️⃣ PC Server Setup (Windows 11)

```powershell
# 1. Navigate to server directory
cd server

# 2. Create and activate virtual environment
python -m venv ..\venv
..\venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the server
python main.py
```

> **Firewall Setup (One-time, Run PowerShell as Administrator):**
> ```powershell
> netsh advfirewall firewall add rule name="KyroPad Server" dir=in action=allow protocol=TCP localport=8080
> ```

---

### 2️⃣ Mobile App Setup (iOS & Android)

```powershell
# 1. Navigate to mobile directory
cd mobile

# 2. Install npm dependencies
npm install

# 3. Start Expo development server
npx expo start
```

1. Open **Expo Go** (Android) or **Camera** (iOS) and scan the terminal QR code.
2. Enter your PC's Wi-Fi IP address (e.g. `192.168.68.102`) and tap **Connect**.
3. *KyroPad remembers your IP automatically for future sessions!*

---

## ⚡ Daily Commands Cheat Sheet

Keep this in your workspace for easy daily startup:

```powershell
# Terminal 1 — Start Windows Server
cd server
..\venv\Scripts\activate
python main.py

# Terminal 2 — Start Mobile Client
cd mobile
npx expo start
```

---

## 📡 Protocol Reference

All phone-to-PC communication happens over high-speed local WebSockets (`ws://<PC_IP>:8080`):

| Message Type | Parameters | Description |
| :--- | :--- | :--- |
| `mouse_move` | `dx: float`, `dy: float` | Relative cursor displacement |
| `mouse_click` | `button: "left" \| "right"` | Instantaneous mouse click |
| `mouse_double_click` | — | Native double click |
| `mouse_down` | `button: "left" \| "right"` | Press and hold mouse button |
| `mouse_up` | `button: "left" \| "right"` | Release held mouse button |
| `mouse_scroll` | `dy: int` | Vertical scroll wheel increments |
| `mouse_zoom` | `delta: int` | Zoom steps (`Ctrl + Scroll`) |
| `get_monitors` | — | Enumerates connected monitors & resolutions |
| `screen_stream_start` | `monitor: int`, `quality: int`, `fps: int` | Initiates live JPEG screen stream |
| `screen_stream_stop` | — | Halts active screen stream |
| `screen_touch_click` | `monitor: int`, `x: float`, `y: float`, `button: str` | Normalized touch click |
| `screen_touch_move` | `monitor: int`, `x: float`, `y: float` | Normalized touch drag |
| `key_type` | `text: str` | Simulates Unicode typing |
| `key_press` | `key: str` | Triggers special key (e.g. `enter`, `ctrl_c`) |
| `win_action` | `action: str` | Triggers Windows hotkey macros |

---

## 📦 Standalone Executable (.exe)

You can compile the server into a standalone Windows executable that runs without requiring Python:

```powershell
cd server
build_exe.bat
```
The compiled binary will be generated at `server/dist/WinDeckRemote.exe` (or `KyroPad.exe`).

---

## 🛡️ Architecture & Tech Stack

- **Client:** React Native (Expo SDK 57), `PanResponder` touch state machine, `AsyncStorage` local caching.
- **Server:** Python 3.11, `websockets`, `pynput`, `pystray` system tray, `Win32 GDI` capture.
- **Network:** Zero cloud dependencies — 100% direct, low-latency local Wi-Fi WebSocket communication.

---

## 📄 License

Distributed under the **MIT License**. Free to use, modify, and distribute for personal and commercial projects.
