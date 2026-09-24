/**
 * ScreenView.js — Live PC Screen Mirroring with Fullscreen Landscape Mode & Direct Touch Control.
 *
 * Features:
 *  - Real-time multi-monitor streaming (Display 1, Display 2, All Displays)
 *  - Fullscreen Landscape toggle with automatic/manual rotation (via expo-screen-orientation)
 *  - Floating translucent control bar in fullscreen (quick exit, switch monitor, keyboard, HD toggle)
 *  - Direct touch-to-click, double-click, right-click, tap & drag, and 2-finger scroll
 *  - Quick-type text input bar
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  PanResponder,
  Vibration,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import webSocketService from '../services/WebSocketService';

const TAP_MAX_DURATION_MS = 200;
const TAP_MAX_MOVEMENT_PX = 10;
const DOUBLE_TAP_MAX_INTERVAL_MS = 300;
const DOUBLE_TAP_MAX_DISTANCE_PX = 30;

const ScreenView = ({ isConnected, isFullscreen, onToggleFullscreen }) => {
  const [frameUri, setFrameUri] = useState(null);
  const [frameInfo, setFrameInfo] = useState({ width: 1920, height: 1080 });
  const [monitors, setMonitors] = useState([
    { id: 2, name: 'Display 2 (Primary)', is_primary: true },
    { id: 1, name: 'Display 1', is_primary: false },
    { id: 0, name: 'All Displays', is_primary: false },
  ]);
  const [selectedMonitor, setSelectedMonitor] = useState(2);
  const [isHD, setIsHD] = useState(false);
  const [showKeyboardInput, setShowKeyboardInput] = useState(false);
  const [inputText, setInputText] = useState('');
  const [controlsVisible, setControlsVisible] = useState(true);

  const selectedMonitorRef = useRef(selectedMonitor);
  selectedMonitorRef.current = selectedMonitor;

  const frameInfoRef = useRef(frameInfo);
  frameInfoRef.current = frameInfo;

  const containerLayout = useRef({ width: 0, height: 0, x: 0, y: 0 });
  const imageContainerRef = useRef(null);

  const gestureState = useRef({
    touchStartTime: 0,
    touchStartX: 0,
    touchStartY: 0,
    lastX: 0,
    lastY: 0,
    activeTouches: 0,
    isScrolling: false,
    lastScrollY: 0,

    lastTapReleaseTime: 0,
    lastTapStartX: 0,
    lastTapStartY: 0,
    isDragging: false,
    dragMovement: 0,
    pendingClickTimer: null,
  });

  // --------------------------------------------------------------------------
  // Orientation & Fullscreen Lifecycle
  // --------------------------------------------------------------------------

  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        onToggleFullscreen?.(true);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        onToggleFullscreen?.(false);
      }
    } catch (err) {
      console.warn('Orientation lock error:', err);
    }
  };

  // Listen to physical device orientation changes
  useEffect(() => {
    const subscription = ScreenOrientation.addOrientationChangeListener((evt) => {
      const orientation = evt.orientationInfo.orientation;
      const isLandscape =
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      onToggleFullscreen?.(isLandscape);
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
      // Reset to portrait on unmount
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [onToggleFullscreen]);

  // --------------------------------------------------------------------------
  // WebSocket Message Routing for Screen Frames
  // --------------------------------------------------------------------------

  useEffect(() => {
    const handleMessage = (data) => {
      if (!data) return;
      if (data.type === 'screen_frame') {
        setFrameUri(data.image);
        if (data.width && data.height) {
          setFrameInfo({ width: data.width, height: data.height });
        }
      } else if (data.type === 'monitors_list') {
        if (Array.isArray(data.monitors) && data.monitors.length > 0) {
          setMonitors(data.monitors);
        }
      }
    };

    const unsubscribe = webSocketService.addListener(handleMessage);
    return () => {
      unsubscribe();
    };
  }, []);

  // --------------------------------------------------------------------------
  // Stream Lifecycle Management
  // --------------------------------------------------------------------------

  const startStream = useCallback(
    (monitorId, highQuality) => {
      if (!isConnected) return;
      webSocketService.send({
        type: 'screen_stream_start',
        monitor: monitorId,
        quality: highQuality ? 75 : 55,
        fps: highQuality ? 20 : 25,
      });
    },
    [isConnected],
  );

  const stopStream = useCallback(() => {
    if (!isConnected) return;
    webSocketService.send({ type: 'screen_stream_stop' });
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      webSocketService.send({ type: 'get_monitors' });
      startStream(selectedMonitor, isHD);
    } else {
      setFrameUri(null);
    }

    return () => {
      stopStream();
    };
  }, [isConnected, selectedMonitor, isHD, startStream, stopStream]);

  // --------------------------------------------------------------------------
  // Coordinate Calculation Helper
  // --------------------------------------------------------------------------

  const getNormalizedCoords = (touchPageX, touchPageY) => {
    const { width: cW, height: cH, x: cX, y: cY } = containerLayout.current;
    if (cW === 0 || cH === 0) return { x: 0.5, y: 0.5 };

    const { width: imgW, height: imgH } = frameInfoRef.current;
    const imgAspect = imgW / (imgH || 1);
    const containerAspect = cW / (cH || 1);

    let renderedW, renderedH, offsetX, offsetY;

    if (containerAspect > imgAspect) {
      renderedH = cH;
      renderedW = cH * imgAspect;
      offsetX = (cW - renderedW) / 2;
      offsetY = 0;
    } else {
      renderedW = cW;
      renderedH = cW / imgAspect;
      offsetX = 0;
      offsetY = (cH - renderedH) / 2;
    }

    const localX = touchPageX - cX;
    const localY = touchPageY - cY;

    const normX = Math.max(0.0, Math.min(1.0, (localX - offsetX) / (renderedW || 1)));
    const normY = Math.max(0.0, Math.min(1.0, (localY - offsetY) / (renderedH || 1)));

    return { x: normX, y: normY };
  };

  // --------------------------------------------------------------------------
  // Touch Handlers & Gestures
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
        state.isScrolling = touches.length >= 2;
        state.lastScrollY = touches.length >= 2 ? (touches[0].pageY + touches[1].pageY) / 2 : 0;

        if (touches.length === 1) {
          const timeSinceLastTap = now - state.lastTapReleaseTime;
          const distFromLastTap = Math.sqrt(
            Math.pow(touch.pageX - state.lastTapStartX, 2) +
            Math.pow(touch.pageY - state.lastTapStartY, 2),
          );

          if (timeSinceLastTap < DOUBLE_TAP_MAX_INTERVAL_MS && distFromLastTap < DOUBLE_TAP_MAX_DISTANCE_PX) {
            // Cancel pending click and engage drag at coordinate
            if (state.pendingClickTimer) {
              clearTimeout(state.pendingClickTimer);
              state.pendingClickTimer = null;
            }

            state.isDragging = true;
            state.dragMovement = 0;
            const { x, y } = getNormalizedCoords(touch.pageX, touch.pageY);
            Vibration.vibrate(10);
            webSocketService.send({
              type: 'screen_touch_down',
              monitor: selectedMonitorRef.current,
              x,
              y,
              button: 'left',
            });
          }
        }
      },

      onPanResponderMove: (event) => {
        const { touches } = event.nativeEvent;
        const state = gestureState.current;
        state.activeTouches = touches.length;

        if (touches.length === 1) {
          const touch = touches[0];
          const dx = touch.pageX - state.lastX;
          const dy = touch.pageY - state.lastY;
          state.lastX = touch.pageX;
          state.lastY = touch.pageY;

          if (state.isDragging) {
            state.dragMovement += Math.abs(dx) + Math.abs(dy);
            const { x, y } = getNormalizedCoords(touch.pageX, touch.pageY);
            webSocketService.send({
              type: 'screen_touch_move',
              monitor: selectedMonitorRef.current,
              x,
              y,
            });
          }
        } else if (touches.length === 2) {
          if (state.isDragging) {
            state.isDragging = false;
            const { x, y } = getNormalizedCoords(touches[0].pageX, touches[0].pageY);
            webSocketService.send({
              type: 'screen_touch_up',
              monitor: selectedMonitorRef.current,
              x,
              y,
              button: 'left',
            });
          }

          const avgY = (touches[0].pageY + touches[1].pageY) / 2;
          const delta = avgY - state.lastScrollY;
          state.lastScrollY = avgY;

          if (Math.abs(delta) >= 2) {
            webSocketService.send({
              type: 'mouse_scroll',
              dy: -Math.round(delta / 4),
            });
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
        const { x, y } = getNormalizedCoords(touch.pageX, touch.pageY);

        if (state.isDragging) {
          webSocketService.send({
            type: 'screen_touch_up',
            monitor: selectedMonitorRef.current,
            x,
            y,
            button: 'left',
          });
          state.isDragging = false;
          state.lastTapReleaseTime = 0;

          if (state.dragMovement < TAP_MAX_MOVEMENT_PX) {
            webSocketService.send({
              type: 'screen_touch_double_click',
              monitor: selectedMonitorRef.current,
              x,
              y,
            });
          }
        } else if (wasTap) {
          if (state.activeTouches >= 2) {
            // Two-finger tap -> Right click at point
            if (state.pendingClickTimer) {
              clearTimeout(state.pendingClickTimer);
              state.pendingClickTimer = null;
            }
            Vibration.vibrate(10);
            webSocketService.send({
              type: 'screen_touch_click',
              monitor: selectedMonitorRef.current,
              x,
              y,
              button: 'right',
            });
            state.lastTapReleaseTime = 0;
          } else {
            // Single tap -> Left click at point
            state.lastTapReleaseTime = now;
            state.lastTapStartX = touch.pageX;
            state.lastTapStartY = touch.pageY;

            state.pendingClickTimer = setTimeout(() => {
              Vibration.vibrate(6);
              webSocketService.send({
                type: 'screen_touch_click',
                monitor: selectedMonitorRef.current,
                x,
                y,
                button: 'left',
              });
              state.pendingClickTimer = null;
            }, 180);
          }
        } else {
          state.lastTapReleaseTime = 0;
        }

        state.isScrolling = false;
      },

      onPanResponderTerminate: () => {
        const state = gestureState.current;
        if (state.pendingClickTimer) {
          clearTimeout(state.pendingClickTimer);
          state.pendingClickTimer = null;
        }
        state.isDragging = false;
        state.isScrolling = false;
        state.lastTapReleaseTime = 0;
      },
    }),
  ).current;

  // --------------------------------------------------------------------------
  // Keyboard Quick Send Handler
  // --------------------------------------------------------------------------

  const handleSendText = () => {
    if (!inputText) return;
    webSocketService.send({ type: 'key_type', text: inputText });
    setInputText('');
  };

  const handleSendEnter = () => {
    webSocketService.send({ type: 'key_press', key: 'enter' });
  };

  const handleSendBackspace = () => {
    webSocketService.send({ type: 'key_press', key: 'backspace' });
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <View style={[styles.container, isFullscreen && styles.containerFullscreen]}>
      <StatusBar hidden={isFullscreen} />

      {/* Top Bar (Portrait Mode) */}
      {!isFullscreen && (
        <View style={styles.monitorBar}>
          {monitors.map((mon) => {
            const isSelected = selectedMonitor === mon.id;
            return (
              <TouchableOpacity
                key={mon.id}
                style={[styles.monitorBtn, isSelected && styles.monitorBtnActive]}
                onPress={() => setSelectedMonitor(mon.id)}
              >
                <Ionicons
                  name="tv-outline"
                  size={13}
                  color={isSelected ? '#00e5ff' : '#777'}
                />
                <Text
                  style={[
                    styles.monitorBtnText,
                    isSelected && styles.monitorBtnTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {mon.name.replace(' (Primary)', '')}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Fullscreen Landscape Toggle */}
          <TouchableOpacity
            style={[styles.controlIconBtn, styles.fullscreenBtn]}
            onPress={toggleFullscreen}
            accessibilityLabel="Toggle Fullscreen Landscape"
          >
            <Ionicons name="scan-outline" size={15} color="#00e5ff" />
          </TouchableOpacity>

          {/* Quality Toggle */}
          <TouchableOpacity
            style={[styles.controlIconBtn, isHD && styles.controlIconBtnActive]}
            onPress={() => setIsHD((prev) => !prev)}
          >
            <Text style={[styles.controlText, isHD && styles.controlTextActive]}>
              {isHD ? 'HD' : 'FAST'}
            </Text>
          </TouchableOpacity>

          {/* Keyboard Toggle */}
          <TouchableOpacity
            style={[
              styles.controlIconBtn,
              showKeyboardInput && styles.controlIconBtnActive,
            ]}
            onPress={() => setShowKeyboardInput((prev) => !prev)}
          >
            <Ionicons
              name="keypad"
              size={15}
              color={showKeyboardInput ? '#00e5ff' : '#888'}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Screen Frame Display Area */}
      <View
        ref={imageContainerRef}
        style={[
          styles.screenFrameWrapper,
          isFullscreen && styles.screenFrameWrapperFullscreen,
        ]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (imageContainerRef.current) {
            imageContainerRef.current.measure(
              (x, y, w, h, pageX, pageY) => {
                containerLayout.current = {
                  width: w || width,
                  height: h || height,
                  x: pageX,
                  y: pageY,
                };
              },
            );
          }
        }}
        {...panResponder.panHandlers}
      >
        {frameUri ? (
          <Image
            source={{ uri: frameUri }}
            style={styles.screenImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#00e5ff" />
            <Text style={styles.loadingText}>
              {isConnected
                ? 'Connecting live screen stream…'
                : 'Connect to PC to view screen'}
            </Text>
          </View>
        )}

        {/* Floating Controls Overlay (In Fullscreen Landscape Mode) */}
        {isFullscreen && controlsVisible && (
          <View style={styles.floatingControls}>
            {/* Exit Fullscreen Button */}
            <TouchableOpacity
              style={styles.floatingBtn}
              onPress={toggleFullscreen}
              accessibilityLabel="Exit Fullscreen"
            >
              <Ionicons name="contract-outline" size={18} color="#fff" />
              <Text style={styles.floatingBtnText}>Exit</Text>
            </TouchableOpacity>

            {/* Next Monitor Quick Switch */}
            <TouchableOpacity
              style={styles.floatingBtn}
              onPress={() => {
                const currentIdx = monitors.findIndex((m) => m.id === selectedMonitor);
                const nextIdx = (currentIdx + 1) % monitors.length;
                setSelectedMonitor(monitors[nextIdx].id);
              }}
            >
              <Ionicons name="tv-outline" size={16} color="#00e5ff" />
              <Text style={styles.floatingBtnText}>
                {selectedMonitor === 0
                  ? 'All'
                  : selectedMonitor === 1
                  ? 'Disp 1'
                  : 'Disp 2'}
              </Text>
            </TouchableOpacity>

            {/* Keyboard Button */}
            <TouchableOpacity
              style={[
                styles.floatingBtn,
                showKeyboardInput && styles.floatingBtnActive,
              ]}
              onPress={() => setShowKeyboardInput((prev) => !prev)}
            >
              <Ionicons
                name="keypad-outline"
                size={16}
                color={showKeyboardInput ? '#00e5ff' : '#fff'}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Quick Typing Input Bar (When Keyboard Toggled) */}
      {showKeyboardInput && (
        <View style={[styles.quickInputBar, isFullscreen && styles.quickInputBarFullscreen]}>
          <TextInput
            style={styles.quickTextInput}
            placeholder="Type text to send to PC…"
            placeholderTextColor="#666"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSendText}
            returnKeyType="send"
            autoFocus
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSendText}>
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.keyBtn} onPress={handleSendBackspace}>
            <Ionicons name="backspace-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.keyBtn} onPress={handleSendEnter}>
            <Ionicons name="return-down-back" size={18} color="#00e5ff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Touch Interaction Instructions (Portrait Mode only) */}
      {!isFullscreen && (
        <View style={styles.hintBar}>
          <Text style={styles.hintText}>
            👆 Tap = Click • Double-Tap = Open • Drag = Move Window • ⛶ = Fullscreen
          </Text>
        </View>
      )}
    </View>
  );
};

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  containerFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: '#000',
  },
  monitorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  monitorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  monitorBtnActive: {
    backgroundColor: '#002b3d',
    borderColor: '#00e5ff',
  },
  monitorBtnText: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
  },
  monitorBtnTextActive: {
    color: '#00e5ff',
    fontWeight: '700',
  },
  controlIconBtn: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenBtn: {
    backgroundColor: '#002b3d',
    borderColor: '#00e5ff',
  },
  controlIconBtnActive: {
    backgroundColor: '#002b3d',
    borderColor: '#00e5ff',
  },
  controlText: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
  },
  controlTextActive: {
    color: '#00e5ff',
  },
  screenFrameWrapper: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  screenFrameWrapperFullscreen: {
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
  },
  screenImage: {
    width: '100%',
    height: '100%',
  },
  loadingBox: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#666',
    fontSize: 13,
  },
  floatingControls: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 1000,
  },
  floatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
  },
  floatingBtnActive: {
    backgroundColor: '#002b3d',
    borderColor: '#00e5ff',
  },
  floatingBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  quickInputBar: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#141414',
    borderTopWidth: 1,
    borderTopColor: '#222',
    gap: 6,
    alignItems: 'center',
  },
  quickInputBarFullscreen: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1001,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
  },
  quickTextInput: {
    flex: 1,
    backgroundColor: '#222',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  keyBtn: {
    backgroundColor: '#222',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintBar: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  hintText: {
    color: '#555',
    fontSize: 10,
    textAlign: 'center',
  },
});

export default ScreenView;
