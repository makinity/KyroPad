/**
 * WebSocketService.js
 *
 * Manages the WebSocket connection to the WinDeck Remote server.
 *
 * Responsibilities:
 *  - Connect / disconnect lifecycle
 *  - Auto-reconnect on unexpected close with exponential back-off
 *  - JSON payload dispatch
 *  - Connection state callbacks so the UI can react to status changes
 */

// Reconnect timing constants — exposed as named values to avoid magic numbers.
const RECONNECT_BASE_DELAY_MS = 1500;
const RECONNECT_MAX_DELAY_MS = 30_000;
const RECONNECT_BACKOFF_FACTOR = 1.5;

class WebSocketService {
  constructor() {
    /** @type {WebSocket | null} */
    this._socket = null;

    /** @type {string | null} Current server URL, e.g. ws://192.168.1.5:8080 */
    this._url = null;

    /** @type {boolean} Whether the user has requested a connection (not yet disconnected). */
    this._intentionallyConnected = false;

    /** @type {number} Current reconnect delay in ms, grows with each failed attempt. */
    this._reconnectDelay = RECONNECT_BASE_DELAY_MS;

    /** @type {ReturnType<setTimeout> | null} */
    this._reconnectTimer = null;

    // External callbacks — consumers assign these after construction.

    /** @type {(() => void) | null} */
    this.onOpen = null;

    /** @type {((code: number, reason: string) => void) | null} */
    this.onClose = null;

    /** @type {((error: Event) => void) | null} */
    this.onError = null;

    /** @type {((data: object) => void) | null} */
    this.onMessage = null;

    /** @type {Set<(data: object) => void>} */
    this._listeners = new Set();
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Subscribe to incoming parsed JSON messages.
   *
   * @param {(data: object) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  addListener(callback) {
    this._listeners.add(callback);
    return () => {
      this._listeners.delete(callback);
    };
  }

  /**
   * Connect to the WinDeck Remote server.
   *
   * Calling connect() while already connected will disconnect first so the
   * caller does not need to manage teardown before switching IPs.
   *
   * @param {string} hostIp  Raw IP address, e.g. "192.168.1.5"
   */
  connect(hostIp) {
    // Trim whitespace to avoid subtle connection failures from user input.
    const cleanIp = hostIp.trim();
    this._url = `ws://${cleanIp}:8080`;
    this._intentionallyConnected = true;
    this._reconnectDelay = RECONNECT_BASE_DELAY_MS;

    // Close any pre-existing socket before opening a new one.
    this._teardown();
    this._open();
  }

  /**
   * Gracefully disconnect and suppress auto-reconnect.
   */
  disconnect() {
    this._intentionallyConnected = false;
    this._clearReconnectTimer();
    this._teardown();
  }

  /**
   * Send a JSON payload to the server.
   *
   * Silently drops the message if the socket is not open — the caller
   * should check isConnected() before firing high-frequency events if
   * precise delivery guarantees are needed.
   *
   * @param {object} payload
   */
  send(payload) {
    if (!this.isConnected()) return;

    try {
      this._socket.send(JSON.stringify(payload));
    } catch (err) {
      console.warn('[WebSocketService] send() failed:', err);
    }
  }

  /**
   * @returns {boolean} True if the socket is open and ready to send.
   */
  isConnected() {
    return this._socket !== null && this._socket.readyState === WebSocket.OPEN;
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  /** Open a new WebSocket and attach event listeners. */
  _open() {
    if (!this._url) return;

    try {
      this._socket = new WebSocket(this._url);
    } catch (err) {
      console.error('[WebSocketService] Failed to construct WebSocket:', err);
      this._scheduleReconnect();
      return;
    }

    this._socket.onopen = () => {
      console.log('[WebSocketService] Connected to', this._url);
      // Reset back-off on successful connection.
      this._reconnectDelay = RECONNECT_BASE_DELAY_MS;
      this.onOpen?.();
    };

    this._socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessage?.(data);
        for (const listener of this._listeners) {
          try {
            listener(data);
          } catch (listenerErr) {
            console.warn('[WebSocketService] Listener error:', listenerErr);
          }
        }
      } catch (err) {
        console.warn('[WebSocketService] Failed to parse message JSON:', err);
      }
    };

    this._socket.onclose = (event) => {
      console.log('[WebSocketService] Closed:', event.code, event.reason);
      this.onClose?.(event.code, event.reason);

      // Only reconnect when the disconnect was not triggered by the user.
      if (this._intentionallyConnected) {
        this._scheduleReconnect();
      }
    };

    this._socket.onerror = (event) => {
      console.warn('[WebSocketService] Error:', event);
      this.onError?.(event);
      // onclose will fire after onerror, which handles reconnect logic.
    };
  }

  /** Close and null-out the current socket without affecting reconnect state. */
  _teardown() {
    if (this._socket) {
      // Remove listeners before closing to prevent double-firing onclose.
      this._socket.onopen = null;
      this._socket.onclose = null;
      this._socket.onerror = null;

      if (
        this._socket.readyState === WebSocket.OPEN ||
        this._socket.readyState === WebSocket.CONNECTING
      ) {
        this._socket.close();
      }

      this._socket = null;
    }
  }

  /**
   * Schedule a reconnect attempt after the current back-off delay.
   * The delay grows up to RECONNECT_MAX_DELAY_MS to avoid flooding
   * the network when the server is unreachable.
   */
  _scheduleReconnect() {
    this._clearReconnectTimer();

    console.log(`[WebSocketService] Reconnecting in ${this._reconnectDelay}ms...`);

    this._reconnectTimer = setTimeout(() => {
      if (this._intentionallyConnected) {
        this._open();
      }
    }, this._reconnectDelay);

    // Grow the delay for the next attempt.
    this._reconnectDelay = Math.min(
      this._reconnectDelay * RECONNECT_BACKOFF_FACTOR,
      RECONNECT_MAX_DELAY_MS,
    );
  }

  _clearReconnectTimer() {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }
}

// Export a singleton so all components share one connection.
const webSocketService = new WebSocketService();
export default webSocketService;
