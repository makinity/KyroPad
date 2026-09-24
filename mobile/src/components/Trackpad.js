/**
 * Trackpad.js
 *
 * A gesture-driven virtual trackpad that translates touch events into
 * WebSocket messages for the WinDeck Remote server.
 *
 * Gesture mapping:
 *  - 1-finger drag          → mouse_move (relative dx/dy with speed scaling)
 *  - 1-finger quick tap     → mouse_click left  (< TAP_MAX_DURATION_MS with minimal movement)
 *  - 2-finger tap           → mouse_click right
 *  - 2-finger vertical drag → mouse_scroll
 */

import React, { useRef, useCallback } from 'react';
import {
  View,
  PanResponder,
  StyleSheet,
  Text,
  Platform,
  Vibration,
} from 'react-native';
import webSocketService from '../services/WebSocketService';

// --------------------------------------------------------------------------
// Tuning constants
// --------------------------------------------------------------------------

/** Multiply raw gesture deltas by this factor to scale for multi-monitor setups. */
const MOUSE_SPEED_MULTIPLIER = 1.8;

/** Divide scroll deltas by this to get a comfortable scroll step count. */
const SCROLL_SENSITIVITY_DIVISOR = 5;

/** Divide pinch deltas by this to get smooth zoom increments. */
const PINCH_SENSITIVITY_DIVISOR = 15;

/** Maximum duration (ms) for a touch to count as a tap (not a drag). */
const TAP_MAX_DURATION_MS = 200;

/** Maximum movement (px) allowed during a tap gesture. */
const TAP_MAX_MOVEMENT_PX = 8;

/** Maximum interval (ms) between two taps to trigger double-tap / tap-to-drag. */
const DOUBLE_TAP_MAX_INTERVAL_MS = 280;

/** Maximum distance (px) between the two taps to count as the same spot. */
const DOUBLE_TAP_MAX_DISTANCE_PX = 30;

/** Distance threshold (px) to trigger 3-finger desktop swipe. */
const THREE_FINGER_SWIPE_THRESHOLD_PX = 45;

// --------------------------------------------------------------------------
// Helper: Distance between two touch points
// --------------------------------------------------------------------------
const getTouchDistance = (t0, t1) => {
  return Math.sqrt(
    Math.pow(t1.pageX - t0.pageX, 2) + Math.pow(t1.pageY - t0.pageY, 2),
  );
};

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

/**
 * @param {{ style?: object }} props
 */
const Trackpad = ({ style }) => {
  // Touch state tracked across PanResponder callbacks.
  const gestureState = useRef({
    touchStartTime: 0,
    touchStartX: 0,
    touchStartY: 0,
    lastX: 0,
    lastY: 0,
    activeTouches: 0,
    isScrolling: false,
    lastScrollY: 0,

    // Double-tap & tap-to-drag tracking
    lastTapReleaseTime: 0,
    lastTapStartX: 0,
    lastTapStartY: 0,
    isDragging: false,
    dragMovement: 0,
    pendingClickTimer: null,

    // Pinch-to-zoom tracking
    lastPinchDistance: 0,

    // 3-Finger gestures
    threeFingerStartX: 0,
    threeFingerStartY: 0,
    threeFingerTriggered: false,
  });

  // --------------------------------------------------------------------------
  // Gesture helpers
  // --------------------------------------------------------------------------

  const sendMouseMove = useCallback((dx, dy) => {
    webSocketService.send({
      type: 'mouse_move',
      dx: dx * MOUSE_SPEED_MULTIPLIER,
      dy: dy * MOUSE_SPEED_MULTIPLIER,
    });
  }, []);

  const sendMouseDown = useCallback((button = 'left') => {
    webSocketService.send({ type: 'mouse_down', button });
  }, []);

  const sendMouseUp = useCallback((button = 'left') => {
    webSocketService.send({ type: 'mouse_up', button });
  }, []);

  const sendMouseClick = useCallback((button = 'left') => {
    webSocketService.send({ type: 'mouse_click', button });
  }, []);

  const sendDoubleClick = useCallback(() => {
    webSocketService.send({ type: 'mouse_double_click' });
  }, []);

  const sendScroll = useCallback((dy) => {
    webSocketService.send({
      type: 'mouse_scroll',
      // Invert dy so natural swipe-down scrolls the page down.
      dy: -Math.round(dy / SCROLL_SENSITIVITY_DIVISOR),
    });
  }, []);

  const sendZoom = useCallback((delta) => {
    webSocketService.send({
      type: 'mouse_zoom',
      delta,
    });
  }, []);

  const sendWinAction = useCallback((action) => {
    webSocketService.send({
      type: 'win_action',
      action,
    });
  }, []);

  // --------------------------------------------------------------------------
  // PanResponder
  // --------------------------------------------------------------------------

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (event) => {
        const { touches } = event.nativeEvent;
        const touch = touches[0];
        const state = gestureState.current;
        const now = Date.now();

        state.touchStartTime = now;
        state.touchStartX = touch.pageX;
        state.touchStartY = touch.pageY;
        state.lastX = touch.pageX;
        state.lastY = touch.pageY;
        state.activeTouches = touches.length;
        state.isScrolling = touches.length === 2;
        state.lastScrollY = touches.length >= 2 ? (touches[0].pageY + touches[1].pageY) / 2 : 0;
        state.threeFingerTriggered = false;

        // 2-Finger setup (pinch & scroll)
        if (touches.length === 2) {
          // Cancel any pending single click
          if (state.pendingClickTimer) {
            clearTimeout(state.pendingClickTimer);
            state.pendingClickTimer = null;
          }
          state.lastPinchDistance = getTouchDistance(touches[0], touches[1]);
        }

        // 3-Finger setup (desktop gestures)
        if (touches.length === 3) {
          if (state.pendingClickTimer) {
            clearTimeout(state.pendingClickTimer);
            state.pendingClickTimer = null;
          }
          state.threeFingerStartX = (touches[0].pageX + touches[1].pageX + touches[2].pageX) / 3;
          state.threeFingerStartY = (touches[0].pageY + touches[1].pageY + touches[2].pageY) / 3;
        }

        // 1-Finger Double-tap / tap-to-drag detection
        if (touches.length === 1) {
          const timeSinceLastTap = now - state.lastTapReleaseTime;
          const distFromLastTap = Math.sqrt(
            Math.pow(touch.pageX - state.lastTapStartX, 2) +
            Math.pow(touch.pageY - state.lastTapStartY, 2),
          );

          if (timeSinceLastTap < DOUBLE_TAP_MAX_INTERVAL_MS && distFromLastTap < DOUBLE_TAP_MAX_DISTANCE_PX) {
            // Cancel the pending 1st click so Windows does NOT receive a double-click on title bars!
            if (state.pendingClickTimer) {
              clearTimeout(state.pendingClickTimer);
              state.pendingClickTimer = null;
            }

            state.isDragging = true;
            state.dragMovement = 0;
            Vibration.vibrate(10);
            sendMouseDown('left');
          } else {
            // Normal new touch - clear any lingering click timer
            if (state.pendingClickTimer) {
              clearTimeout(state.pendingClickTimer);
              state.pendingClickTimer = null;
              sendMouseClick('left');
            }
          }
        }
      },

      onPanResponderMove: (event) => {
        const { touches } = event.nativeEvent;
        const state = gestureState.current;
        state.activeTouches = touches.length;

        if (touches.length === 1) {
          // Single-finger movement
          const touch = touches[0];
          const dx = touch.pageX - state.lastX;
          const dy = touch.pageY - state.lastY;
          state.lastX = touch.pageX;
          state.lastY = touch.pageY;

          if (state.isDragging) {
            state.dragMovement += Math.abs(dx) + Math.abs(dy);
          }

          if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
            sendMouseMove(dx, dy);
          }
        } else if (touches.length === 2) {
          // Release drag if active
          if (state.isDragging) {
            state.isDragging = false;
            sendMouseUp('left');
          }

          const currentPinchDist = getTouchDistance(touches[0], touches[1]);
          const pinchDelta = currentPinchDist - state.lastPinchDistance;
          const avgY = (touches[0].pageY + touches[1].pageY) / 2;
          const scrollDelta = avgY - state.lastScrollY;

          // Check if gesture is Pinch-to-Zoom or Scroll
          if (Math.abs(pinchDelta) > 12 && Math.abs(pinchDelta) > Math.abs(scrollDelta) * 0.7) {
            const zoomSteps = Math.round(pinchDelta / PINCH_SENSITIVITY_DIVISOR);
            if (zoomSteps !== 0) {
              sendZoom(zoomSteps);
              state.lastPinchDistance = currentPinchDist;
              state.lastScrollY = avgY;
            }
          } else {
            state.lastScrollY = avgY;
            state.lastPinchDistance = currentPinchDist;
            if (Math.abs(scrollDelta) >= 1) {
              sendScroll(scrollDelta);
            }
          }
        } else if (touches.length === 3 && !state.threeFingerTriggered) {
          // 3-Finger Desktop Navigation
          const avgX = (touches[0].pageX + touches[1].pageX + touches[2].pageX) / 3;
          const avgY = (touches[0].pageY + touches[1].pageY + touches[2].pageY) / 3;
          const deltaX = avgX - state.threeFingerStartX;
          const deltaY = avgY - state.threeFingerStartY;

          if (Math.abs(deltaY) > THREE_FINGER_SWIPE_THRESHOLD_PX || Math.abs(deltaX) > THREE_FINGER_SWIPE_THRESHOLD_PX) {
            state.threeFingerTriggered = true;
            Vibration.vibrate(15);

            if (Math.abs(deltaY) > Math.abs(deltaX)) {
              if (deltaY < -THREE_FINGER_SWIPE_THRESHOLD_PX) {
                // Swipe Up -> Task View
                sendWinAction('task_view');
              } else if (deltaY > THREE_FINGER_SWIPE_THRESHOLD_PX) {
                // Swipe Down -> Show Desktop
                sendWinAction('show_desktop');
              }
            } else {
              if (deltaX < -THREE_FINGER_SWIPE_THRESHOLD_PX) {
                // Swipe Left -> Previous Virtual Desktop
                sendWinAction('switch_desktop_left');
              } else if (deltaX > THREE_FINGER_SWIPE_THRESHOLD_PX) {
                // Swipe Right -> Next Virtual Desktop
                sendWinAction('switch_desktop_right');
              }
            }
          }
        }
      },

      onPanResponderRelease: (event) => {
        const { changedTouches } = event.nativeEvent;
        const state = gestureState.current;
        const now = Date.now();
        const duration = now - state.touchStartTime;

        const touch = changedTouches[0];
        const totalMovement = Math.sqrt(
          Math.pow(touch.pageX - state.touchStartX, 2) +
          Math.pow(touch.pageY - state.touchStartY, 2),
        );

        const wasTap = duration < TAP_MAX_DURATION_MS && totalMovement < TAP_MAX_MOVEMENT_PX;

        if (state.isDragging) {
          sendMouseUp('left');
          state.isDragging = false;
          state.lastTapReleaseTime = 0;

          // If the user tapped twice quickly without moving, treat it as a Double Click
          if (state.dragMovement < TAP_MAX_MOVEMENT_PX) {
            sendDoubleClick();
          }
        } else if (wasTap) {
          if (state.activeTouches >= 2) {
            // Two-finger tap -> Right Click
            if (state.pendingClickTimer) {
              clearTimeout(state.pendingClickTimer);
              state.pendingClickTimer = null;
            }
            Vibration.vibrate(10);
            sendMouseClick('right');
            state.lastTapReleaseTime = 0;
          } else {
            // Single-finger tap:
            // Record tap location & time
            state.lastTapReleaseTime = now;
            state.lastTapStartX = touch.pageX;
            state.lastTapStartY = touch.pageY;

            // Defer sending click by 180ms so a second tap can engage clean drag without title bar double-click
            state.pendingClickTimer = setTimeout(() => {
              Vibration.vibrate(6);
              sendMouseClick('left');
              state.pendingClickTimer = null;
            }, 180);
          }
        } else {
          state.lastTapReleaseTime = 0;
        }

        state.isScrolling = false;
        state.threeFingerTriggered = false;
      },

      onPanResponderTerminate: () => {
        const state = gestureState.current;
        if (state.pendingClickTimer) {
          clearTimeout(state.pendingClickTimer);
          state.pendingClickTimer = null;
        }
        if (state.isDragging) {
          sendMouseUp('left');
          state.isDragging = false;
        }
        state.isScrolling = false;
        state.threeFingerTriggered = false;
        state.lastTapReleaseTime = 0;
      },
    }),
  ).current;

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <View
      style={[styles.trackpad, style]}
      {...panResponder.panHandlers}
      accessible
      accessibilityLabel="Trackpad. Drag to move cursor. Tap to click. Double-tap and hold to drag. Two-finger tap to right-click. Two-finger pinch to zoom. Two-finger drag to scroll. Three-finger swipe for desktop controls."
      accessibilityRole="adjustable"
    >
      <Text style={styles.hint}>Trackpad</Text>
      <Text style={styles.subHint}>
        1-finger move • tap = click • double-tap & hold = drag{'\n'}
        2-finger pinch = zoom • 2-finger scroll • 2-finger tap = right-click{'\n'}
        3-finger swipe = desktop & task view
      </Text>
    </View>
  );
};

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const styles = StyleSheet.create({
  trackpad: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 220,
  },
  hint: {
    color: '#555',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 6,
  },
  subHint: {
    color: '#3a3a3a',
    fontSize: 10,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 16,
  },
});

export default Trackpad;
