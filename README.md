# KyroPad 🎮📱

> **Smart Multi-Monitor Remote, Precision Trackpad & Live Screen Controller for Windows 11.**

Control your Windows PC from your iPhone or Android device over low-latency local Wi-Fi. Features a gesture-accurate precision trackpad, live multi-monitor screen streaming with touch-to-click, custom macro deck shortcuts, and a virtual keyboard.

---

## 🌟 Key Features

- 🖱️ **Precision Trackpad:**
  - 1-finger move & tap to click.
  - Double-tap and hold to **drag-and-drop / select text / move windows**.
  - 2-finger tap for **right-click**.
  - 2-finger pinch for **zoom in / zoom out**.
  - 2-finger slide for **vertical scrolling**.
  - 3-finger swipe for **Task View (`Win+Tab`)**, **Show Desktop (`Win+D`)**, and **Virtual Desktop switching**.
  - Tactile **haptic vibration feedback**.

- 🖥️ **Live Screen Streaming & Interactive Touch:**
  - Stream your PC desktop live to your phone at 20–25+ FPS.
  - **Multi-Monitor Switcher:** Instant toggle between Display 1, Display 2, or All Displays combined.
  - **Direct Touch-to-Click:** Tap directly on apps, folders, or buttons on your phone screen to click them on Windows.
  - Quick-type input bar to type directly into active Windows search bars or applications.

- 🎛️ **Macro Deck:**
  - One-tap buttons for window management (snap left/right, maximize, fling to next monitor).
  - System controls (volume up/down, mute, lock PC).

- ⌨️ **Virtual Keyboard:**
  - Fast text typing, special shortcuts (`Ctrl+C`, `Ctrl+V`, `Ctrl+Z`, `Ctrl+A`, `Enter`, `Backspace`, `Esc`, etc.).

- 💾 **Persistent Connection:**
  - Remembers your last-used server IP address automatically.

---

## 📁 Project Structure

```
kyropad/
├── server/                         # Python Windows Server
│   ├── main.py                     # WebSocket server + system tray icon
│   ├── screen_stream.py            # Win32 GDI screen capture & coordinate mapper
│   ├── win_actions.py              # Windows hotkeys, mouse & keyboard simulator
│   ├── requirements.txt            # Python dependencies
│   └── build_exe.bat               # PyInstaller executable builder
│
├── mobile/                         # React Native / Expo Client
│   ├── App.js                      # Root component & tab navigation
│   ├── app.json                    # Expo configuration
│   ├── package.json                # Dependencies
│   └── src/
│       ├── services/
│       │   └── WebSocketService.js # WebSocket client with auto-reconnect & listeners
│       └── components/
│           ├── ScreenView.js       # Live screen stream & direct touch overlay
│           ├── Trackpad.js         # Gesture trackpad
│           ├── MacroGrid.js        # Windows 11 macro deck
│           └── KeyboardPanel.js    # Virtual keyboard
│
├── commands.md                     # Daily quickstart cheat sheet
└── README.md
```

---

## 🚀 Quickstart

### 1. Server Setup (Windows)

1. Open PowerShell and navigate to the `server/` directory:
   ```powershell
   cd server
   python -m venv ..\venv
   ..\venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Start the server:
   ```powershell
   python main.py
   ```
   *(A cyan "K" icon will appear in your Windows System Tray)*

3. *(One-time)* Allow Port 8080 through Windows Firewall (Run as Administrator):
   ```powershell
   netsh advfirewall firewall add rule name="KyroPad Server" dir=in action=allow protocol=TCP localport=8080
   ```

---

### 2. Mobile App Setup (iOS / Android)

1. Navigate to the `mobile/` directory and install dependencies:
   ```powershell
   cd mobile
   npm install
   ```

2. Start the Expo development server:
   ```powershell
   npx expo start
   ```

3. **Open on Device:**
   - **iOS:** Open Camera app and scan the QR code to launch in **Expo Go**.
   - **Android:** Open the **Expo Go** app and scan the QR code.
   - Enter your PC's Wi-Fi IP address (e.g. `192.168.68.102`) and tap **Connect**.

---

## ⚡ Daily Commands Cheat Sheet

```powershell
# Terminal 1 — Run Server
cd server
..\venv\Scripts\activate
python main.py

# Terminal 2 — Run Mobile App
cd mobile
npx expo start
```

---

## 📡 WebSocket Protocol Reference

All communication between phone and PC occurs over local WebSockets (`ws://<PC_IP>:8080`).

| Message Type | Payload Parameters | Description |
| :--- | :--- | :--- |
| `mouse_move` | `dx`, `dy` | Relative mouse cursor movement |
| `mouse_click` | `button` ("left" \| "right") | Single mouse click |
| `mouse_double_click`| — | Double left click |
| `mouse_down` | `button` | Press & hold mouse button |
| `mouse_up` | `button` | Release held mouse button |
| `mouse_scroll` | `dy` | Mouse wheel vertical scroll |
| `mouse_zoom` | `delta` | Zoom in / out (`Ctrl + Scroll`) |
| `get_monitors` | — | Requests list of available displays |
| `screen_stream_start`| `monitor`, `quality`, `fps` | Starts live screen streaming |
| `screen_stream_stop` | — | Stops live screen streaming |
| `screen_touch_click` | `monitor`, `x`, `y`, `button` | Touch-to-click at normalized $(x, y)$ |
| `screen_touch_move` | `monitor`, `x`, `y` | Touch drag at normalized $(x, y)$ |
| `key_type` | `text` | Types text on active Windows window |
| `key_press` | `key` | Presses special key / combo |
| `win_action` | `action` | Executes named Windows hotkey |

---

## 📦 Building Standalone Windows Executable (.exe)

To bundle the Python server into a single portable `.exe` (no Python installation required):

```powershell
cd server
build_exe.bat
```

The compiled binary will be placed at `server/dist/WinDeckRemote.exe` (or `KyroPad.exe`).

---

## 📄 License

MIT License — Free to use, modify, and distribute.
