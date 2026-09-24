/**
 * ScreenView.js — Live PC Screen Mirroring & Interactive Touch Control for KyroPad.
 *
 * Features:
 *  - Real-time multi-monitor streaming (~20-25 FPS)
 *  - Display selector (Display 1, Display 2, All Displays combined)
 *  - Pixel-perfect touch mapping (Tap to click, double-tap, right-click, tap & drag)
 *  - 2-finger scroll
 *  - Quick typing bar to send text to whatever text box is open on your PC
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import webSocketService from '../services/WebSocketService';

const TAP_MAX_DURATION_MS = 200;
const TAP_MAX_MOVEMENT_PX = 10;
const DOUBLE_TAP_MAX_INTERVAL_MS = 300;
const DOUBLE_TAP_MAX_DISTANCE_PX = 30;

const ScreenView = ({ isConnected }) => {
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
        quality: highQuality ? 75 : 60,
        fps: highQuality ? 20 : 24,
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

    const { width: imgW, height: imgH } = frameInfo;
    const imgAspect = imgW / imgH;
    const containerAspect = cW / cH;

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

    const normX = Math.max(0.0, Math.min(1.0, (localX - offsetX) / renderedW));
    const normY = Math.max(0.0, Math.min(1.0, (localY - offsetY) / renderedH));

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
              monitor: selectedMonitor,
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
              monitor: selectedMonitor,
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
              monitor: selectedMonitor,
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
            monitor: selectedMonitor,
            x,
            y,
            button: 'left',
          });
          state.isDragging = false;
          state.lastTapReleaseTime = 0;

          if (state.dragMovement < TAP_MAX_MOVEMENT_PX) {
            webSocketService.send({
              type: 'screen_touch_double_click',
              monitor: selectedMonitor,
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
              monitor: selectedMonitor,
              x,
              y,
              button: 'right',
            });
            state.lastTapReleaseTime = 0;
          } else {
            // Single tap -> Left click at point (deferred by 180ms for double-tap detection)
            state.lastTapReleaseTime = now;
            state.lastTapStartX = touch.pageX;
            state.lastTapStartY = touch.pageY;

            state.pendingClickTimer = setTimeout(() => {
              Vibration.vibrate(6);
              webSocketService.send({
                type: 'screen_touch_click',
                monitor: selectedMonitor,
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
    <View style={styles.container}>
      {/* Monitor Selector Bar */}
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
                size={14}
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
            size={16}
            color={showKeyboardInput ? '#00e5ff' : '#888'}
          />
        </TouchableOpacity>
      </View>

      {/* Screen Frame Display Area */}
      <View
        ref={imageContainerRef}
        style={styles.screenFrameWrapper}
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
      </View>

      {/* Quick Typing Input Bar (When Keyboard Toggled) */}
      {showKeyboardInput && (
        <View style={styles.quickInputBar}>
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
            <Text style={styles.sendBtnText}>Type</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.keyBtn}
            onPress={handleSendBackspace}
          >
            <Ionicons name="backspace-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.keyBtn} onPress={handleSendEnter}>
            <Ionicons name="return-down-back" size={18} color="#00e5ff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Touch Interaction Instructions */}
      <View style={styles.hintBar}>
        <Text style={styles.hintText}>
          👆 Tap = Click • Double-Tap = Open • Drag = Move Window • 2-Finger Slide = Scroll
        </Text>
      </View>
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
    paddingHorizontal: 8,
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
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
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
