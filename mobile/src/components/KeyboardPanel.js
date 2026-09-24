/**
 * KeyboardPanel.js
 *
 * Remote keyboard panel — lets the user type text and press special keys
 * on the connected Windows PC.
 *
 * Layout:
 *  - Text input area (triggers the phone's native keyboard)
 *  - "Send" button to type the buffered text
 *  - Row of special-key buttons: Backspace, Tab, Enter, Escape
 *  - Row of nav-key buttons: ← ↑ ↓ →
 *  - Row of shortcut buttons: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+X
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import webSocketService from '../services/WebSocketService';

// --------------------------------------------------------------------------
// Key button definitions
// --------------------------------------------------------------------------

const SPECIAL_KEYS = [
  { label: '⌫ Back',  key: 'backspace', color: '#d13438' },
  { label: 'Tab',      key: 'tab',       color: '#5c2d91' },
  { label: '↵ Enter', key: 'enter',      color: '#107c10' },
  { label: 'Esc',      key: 'escape',    color: '#ca5010' },
  { label: 'Del',      key: 'delete',    color: '#868686' },
];

const NAV_KEYS = [
  { label: '↑', key: 'up'    },
  { label: '↓', key: 'down'  },
  { label: '←', key: 'left'  },
  { label: '→', key: 'right' },
  { label: 'Home', key: 'home'      },
  { label: 'End',  key: 'end'       },
  { label: 'PgUp', key: 'page_up'   },
  { label: 'PgDn', key: 'page_down' },
];

const SHORTCUT_KEYS = [
  { label: 'Ctrl+A', key: 'ctrl_a', color: '#0078d4' },
  { label: 'Ctrl+C', key: 'ctrl_c', color: '#0078d4' },
  { label: 'Ctrl+V', key: 'ctrl_v', color: '#0078d4' },
  { label: 'Ctrl+Z', key: 'ctrl_z', color: '#ca5010' },
  { label: 'Ctrl+X', key: 'ctrl_x', color: '#d13438' },
  { label: 'Ctrl+S', key: 'ctrl_s', color: '#107c10' },
];

// --------------------------------------------------------------------------
// Sub-component: KeyButton
// --------------------------------------------------------------------------

const KeyButton = ({ label, onPress, color = '#444', wide = false }) => (
  <TouchableOpacity
    style={[styles.keyBtn, wide && styles.keyBtnWide, { borderColor: color + '66' }]}
    onPress={onPress}
    activeOpacity={0.6}
    accessibilityLabel={label}
    accessibilityRole="button"
  >
    <Text style={[styles.keyBtnLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
);

// --------------------------------------------------------------------------
// Main component
// --------------------------------------------------------------------------

const KeyboardPanel = () => {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  const sendSpecialKey = useCallback((key) => {
    if (!webSocketService.isConnected()) return;
    webSocketService.send({ type: 'key_press', key });
  }, []);

  const sendText = useCallback(() => {
    if (!webSocketService.isConnected() || !text) return;
    webSocketService.send({ type: 'key_type', text });
    setText('');
  }, [text]);

  // Send text on every keystroke in "live" mode — feels more natural
  // than batching. We track what was already sent to only transmit the diff.
  const lastSentRef = useRef('');

  const handleTextChange = useCallback((newValue) => {
    setText(newValue);

    if (!webSocketService.isConnected()) return;

    const prev = lastSentRef.current;

    // Detect backspace: new value is shorter than last sent.
    if (newValue.length < prev.length) {
      const deleteCount = prev.length - newValue.length;
      for (let i = 0; i < deleteCount; i++) {
        webSocketService.send({ type: 'key_press', key: 'backspace' });
      }
      lastSentRef.current = newValue;
      return;
    }

    // New characters appended — type only the diff.
    if (newValue.startsWith(prev)) {
      const diff = newValue.slice(prev.length);
      if (diff) {
        webSocketService.send({ type: 'key_type', text: diff });
        lastSentRef.current = newValue;
      }
    } else {
      // The user edited in the middle — send the full value and reset.
      webSocketService.send({ type: 'key_type', text: newValue });
      lastSentRef.current = newValue;
    }
  }, []);

  const handleClear = useCallback(() => {
    setText('');
    lastSentRef.current = '';
    inputRef.current?.focus();
  }, []);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.inner}
      keyboardShouldPersistTaps="handled"
    >
      {/* Text input */}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={text}
          onChangeText={handleTextChange}
          placeholder="Tap here to type on PC…"
          placeholderTextColor="#444"
          multiline={false}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="send"
          onSubmitEditing={() => sendSpecialKey('enter')}
          accessibilityLabel="Keyboard input field"
        />
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={handleClear}
          accessibilityLabel="Clear input"
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={20} color="#555" />
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        Characters are sent live as you type. Use the buttons below for special keys.
      </Text>

      {/* Special keys */}
      <Text style={styles.sectionLabel}>Special Keys</Text>
      <View style={styles.keyRow}>
        {SPECIAL_KEYS.map((k) => (
          <KeyButton
            key={k.key}
            label={k.label}
            color={k.color}
            onPress={() => sendSpecialKey(k.key)}
          />
        ))}
      </View>

      {/* Navigation keys */}
      <Text style={styles.sectionLabel}>Navigation</Text>
      <View style={styles.keyRow}>
        {NAV_KEYS.map((k) => (
          <KeyButton
            key={k.key}
            label={k.label}
            color="#888"
            onPress={() => sendSpecialKey(k.key)}
          />
        ))}
      </View>

      {/* Shortcuts */}
      <Text style={styles.sectionLabel}>Shortcuts</Text>
      <View style={styles.keyRow}>
        {SHORTCUT_KEYS.map((k) => (
          <KeyButton
            key={k.key}
            label={k.label}
            color={k.color}
            onPress={() => sendSpecialKey(k.key)}
          />
        ))}
      </View>
    </ScrollView>
  );
};

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    paddingBottom: 40,
  },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 14,
  },
  clearBtn: {
    padding: 6,
  },
  hint: {
    color: '#3a3a3a',
    fontSize: 11,
    marginBottom: 16,
    paddingHorizontal: 2,
  },

  // Section labels
  sectionLabel: {
    color: '#555',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },

  // Key rows
  keyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  keyBtn: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtnWide: {
    paddingHorizontal: 20,
  },
  keyBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default KeyboardPanel;
