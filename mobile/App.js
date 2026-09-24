/**
 * App.js — WinDeck Remote root component.
 *
 * Layout:
 *  - Header with connection status indicator
 *  - IP input + Connect/Disconnect button
 *  - Tab switcher: Trackpad | Macro Deck
 *  - Active tab content
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import webSocketService from './src/services/WebSocketService';
import ScreenView from './src/components/ScreenView';
import Trackpad from './src/components/Trackpad';
import MacroGrid from './src/components/MacroGrid';
import KeyboardPanel from './src/components/KeyboardPanel';

const STORAGE_KEY_LAST_IP = '@windeck_last_server_ip';

// --------------------------------------------------------------------------
// Connection status values
// --------------------------------------------------------------------------

const CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
};

const STATUS_COLORS = {
  [CONNECTION_STATUS.DISCONNECTED]: '#555',
  [CONNECTION_STATUS.CONNECTING]:   '#f0a500',
  [CONNECTION_STATUS.CONNECTED]:    '#107c10',
  [CONNECTION_STATUS.ERROR]:        '#d13438',
};

const STATUS_LABELS = {
  [CONNECTION_STATUS.DISCONNECTED]: 'Disconnected',
  [CONNECTION_STATUS.CONNECTING]:   'Connecting…',
  [CONNECTION_STATUS.CONNECTED]:    'Connected',
  [CONNECTION_STATUS.ERROR]:        'Connection error',
};

// --------------------------------------------------------------------------
// Tab definitions
// --------------------------------------------------------------------------

const TABS = {
  SCREEN: 'screen',
  TRACKPAD: 'trackpad',
  MACROS: 'macros',
  KEYBOARD: 'keyboard',
};

// --------------------------------------------------------------------------
// Root component
// --------------------------------------------------------------------------

export default function App() {
  const [ipAddress, setIpAddress] = useState('');
  const [status, setStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  const [activeTab, setActiveTab] = useState(TABS.TRACKPAD);

  // --------------------------------------------------------------------------
  // Restore persisted IP on mount
  // --------------------------------------------------------------------------

  useEffect(() => {
    const loadSavedIp = async () => {
      try {
        const savedIp = await AsyncStorage.getItem(STORAGE_KEY_LAST_IP);
        if (savedIp) {
          setIpAddress(savedIp);
        }
      } catch (err) {
        console.warn('Failed to load saved IP:', err);
      }
    };
    loadSavedIp();
  }, []);

  // --------------------------------------------------------------------------
  // WebSocket lifecycle
  // --------------------------------------------------------------------------

  useEffect(() => {
    // Attach callbacks once on mount; teardown on unmount.
    webSocketService.onOpen = () => setStatus(CONNECTION_STATUS.CONNECTED);

    webSocketService.onClose = () => {
      // If we're still "intending" to connect, show reconnecting state.
      setStatus((prev) =>
        prev === CONNECTION_STATUS.CONNECTED
          ? CONNECTION_STATUS.CONNECTING
          : CONNECTION_STATUS.DISCONNECTED,
      );
    };

    webSocketService.onError = () => setStatus(CONNECTION_STATUS.ERROR);

    return () => {
      webSocketService.onOpen = null;
      webSocketService.onClose = null;
      webSocketService.onError = null;
      webSocketService.disconnect();
    };
  }, []);

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleConnect = useCallback(async () => {
    const trimmed = ipAddress.trim();
    if (!trimmed) return;

    try {
      await AsyncStorage.setItem(STORAGE_KEY_LAST_IP, trimmed);
    } catch (err) {
      console.warn('Failed to save IP:', err);
    }

    setStatus(CONNECTION_STATUS.CONNECTING);
    webSocketService.connect(trimmed);
  }, [ipAddress]);

  const handleDisconnect = useCallback(() => {
    setStatus(CONNECTION_STATUS.DISCONNECTED);
    webSocketService.disconnect();
  }, []);

  const isConnected = status === CONNECTION_STATUS.CONNECTED;
  const isConnecting = status === CONNECTION_STATUS.CONNECTING;

  // --------------------------------------------------------------------------
  // Render helpers
  // --------------------------------------------------------------------------

  const renderConnectionBar = () => (
    <View style={styles.connectionBar}>
      <TextInput
        style={styles.ipInput}
        placeholder="Server IP  (e.g. 192.168.1.5)"
        placeholderTextColor="#555"
        value={ipAddress}
        onChangeText={setIpAddress}
        keyboardType="decimal-pad"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isConnected && !isConnecting}
        returnKeyType="done"
        onSubmitEditing={handleConnect}
        accessibilityLabel="Server IP address input"
      />

      {isConnected ? (
        <TouchableOpacity
          style={[styles.connectBtn, styles.disconnectBtn]}
          onPress={handleDisconnect}
          accessibilityLabel="Disconnect from server"
          accessibilityRole="button"
        >
          <Text style={styles.connectBtnText}>Disconnect</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.connectBtn, isConnecting && styles.connectBtnDisabled]}
          onPress={handleConnect}
          disabled={isConnecting}
          accessibilityLabel="Connect to server"
          accessibilityRole="button"
        >
          <Text style={styles.connectBtnText}>
            {isConnecting ? 'Connecting…' : 'Connect'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tabItem, activeTab === TABS.SCREEN && styles.tabItemActive]}
        onPress={() => setActiveTab(TABS.SCREEN)}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === TABS.SCREEN }}
        accessibilityLabel="Screen tab"
      >
        <Ionicons
          name="desktop-outline"
          size={18}
          color={activeTab === TABS.SCREEN ? '#00e5ff' : '#666'}
        />
        <Text style={[styles.tabLabel, activeTab === TABS.SCREEN && styles.tabLabelActiveScreen]}>
          Screen
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabItem, activeTab === TABS.TRACKPAD && styles.tabItemActive]}
        onPress={() => setActiveTab(TABS.TRACKPAD)}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === TABS.TRACKPAD }}
        accessibilityLabel="Trackpad tab"
      >
        <Ionicons
          name="hand-left-outline"
          size={18}
          color={activeTab === TABS.TRACKPAD ? '#0078d4' : '#666'}
        />
        <Text style={[styles.tabLabel, activeTab === TABS.TRACKPAD && styles.tabLabelActive]}>
          Trackpad
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabItem, activeTab === TABS.MACROS && styles.tabItemActive]}
        onPress={() => setActiveTab(TABS.MACROS)}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === TABS.MACROS }}
        accessibilityLabel="Macro Deck tab"
      >
        <Ionicons
          name="grid-outline"
          size={18}
          color={activeTab === TABS.MACROS ? '#0078d4' : '#666'}
        />
        <Text style={[styles.tabLabel, activeTab === TABS.MACROS && styles.tabLabelActive]}>
          Macros
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabItem, activeTab === TABS.KEYBOARD && styles.tabItemActive]}
        onPress={() => setActiveTab(TABS.KEYBOARD)}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === TABS.KEYBOARD }}
        accessibilityLabel="Keyboard tab"
      >
        <Ionicons
          name="keypad-outline"
          size={18}
          color={activeTab === TABS.KEYBOARD ? '#0078d4' : '#666'}
        />
        <Text style={[styles.tabLabel, activeTab === TABS.KEYBOARD && styles.tabLabelActive]}>
          Keys
        </Text>
      </TouchableOpacity>
    </View>
  );

  // --------------------------------------------------------------------------
  // Main render
  // --------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>KyroPad</Text>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLORS[status] }]}>
            {STATUS_LABELS[status]}
          </Text>
        </View>
      </View>

      {/* Connection bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {renderConnectionBar()}
      </KeyboardAvoidingView>

      {/* Tab bar */}
      {renderTabBar()}

      {/* Tab content */}
      <View style={[styles.content, activeTab === TABS.SCREEN && styles.contentScreen]}>
        {activeTab === TABS.SCREEN ? (
          <ScreenView isConnected={isConnected} />
        ) : activeTab === TABS.TRACKPAD ? (
          <Trackpad style={styles.trackpad} />
        ) : activeTab === TABS.KEYBOARD ? (
          <KeyboardPanel />
        ) : (
          <ScrollView contentContainerStyle={styles.macroScroll}>
            <MacroGrid />
          </ScrollView>
        )}
      </View>

      {/* Disconnected overlay hint (only when not on Screen tab) */}
      {!isConnected && activeTab !== TABS.SCREEN && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayText}>
            {isConnecting
              ? 'Connecting to server…'
              : 'Enter the server IP and tap Connect'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 8 : 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  appTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Connection bar
  connectionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  ipInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    fontSize: 15,
  },
  connectBtn: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectBtnDisabled: {
    backgroundColor: '#1e4f78',
  },
  disconnectBtn: {
    backgroundColor: '#d13438',
  },
  connectBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#0078d4',
  },
  tabLabel: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#0078d4',
  },
  tabLabelActiveScreen: {
    color: '#00e5ff',
  },

  // Content area
  content: {
    flex: 1,
    padding: 12,
  },
  contentScreen: {
    padding: 0,
  },
  trackpad: {
    flex: 1,
  },
  macroScroll: {
    flexGrow: 1,
  },

  // Disconnected overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  overlayText: {
    color: '#444',
    fontSize: 13,
    fontStyle: 'italic',
  },
});
