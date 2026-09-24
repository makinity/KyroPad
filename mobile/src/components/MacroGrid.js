/**
 * MacroGrid.js
 *
 * A grid of quick-action cards that send win_action payloads to the server.
 *
 * Actions are defined in a data array so adding new macros requires only
 * a new entry — no additional render logic needed.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import webSocketService from '../services/WebSocketService';

// --------------------------------------------------------------------------
// Action definitions
// --------------------------------------------------------------------------

/**
 * Each entry defines one macro card.
 *
 * @type {Array<{
 *   id: string,
 *   label: string,
 *   icon: string,
 *   action: string,
 *   color: string,
 * }>}
 */
const MACRO_ACTIONS = [
  {
    id: 'fling_right',
    label: 'Fling →',
    icon: 'arrow-forward-circle-outline',
    action: 'window_fling_right',
    color: '#0078d4',
  },
  {
    id: 'fling_left',
    label: '← Fling',
    icon: 'arrow-back-circle-outline',
    action: 'window_fling_left',
    color: '#0078d4',
  },
  {
    id: 'snap_left',
    label: 'Snap Left',
    icon: 'square-outline',
    action: 'snap_left',
    color: '#5c2d91',
  },
  {
    id: 'snap_right',
    label: 'Snap Right',
    icon: 'square-outline',
    action: 'snap_right',
    color: '#5c2d91',
  },
  {
    id: 'snap_up',
    label: 'Maximize',
    icon: 'expand-outline',
    action: 'snap_up',
    color: '#107c10',
  },
  {
    id: 'snap_down',
    label: 'Restore',
    icon: 'contract-outline',
    action: 'snap_down',
    color: '#107c10',
  },
  {
    id: 'task_view',
    label: 'Task View',
    icon: 'apps-outline',
    action: 'task_view',
    color: '#d13438',
  },
  {
    id: 'volume_mute',
    label: 'Mute',
    icon: 'volume-mute-outline',
    action: 'volume_mute',
    color: '#ca5010',
  },
  {
    id: 'volume_up',
    label: 'Vol +',
    icon: 'volume-high-outline',
    action: 'volume_up',
    color: '#ca5010',
  },
  {
    id: 'volume_down',
    label: 'Vol −',
    icon: 'volume-low-outline',
    action: 'volume_down',
    color: '#ca5010',
  },
  {
    id: 'lock_pc',
    label: 'Lock PC',
    icon: 'lock-closed-outline',
    action: 'lock_pc',
    color: '#868686',
  },
];

// --------------------------------------------------------------------------
// Sub-component: MacroCard
// --------------------------------------------------------------------------

/**
 * @param {{
 *   label: string,
 *   icon: string,
 *   color: string,
 *   onPress: () => void,
 * }} props
 */
const MacroCard = ({ label, icon, color, onPress }) => (
  <TouchableOpacity
    style={[styles.card, { borderColor: color + '55' }]}
    onPress={onPress}
    activeOpacity={0.65}
    accessible
    accessibilityLabel={label}
    accessibilityRole="button"
  >
    <Ionicons name={icon} size={26} color={color} />
    <Text style={[styles.cardLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
);

// --------------------------------------------------------------------------
// Main component
// --------------------------------------------------------------------------

const MacroGrid = () => {
  const handlePress = useCallback((action) => {
    if (!webSocketService.isConnected()) return;
    webSocketService.send({ type: 'win_action', action });
  }, []);

  const renderItem = useCallback(
    ({ item }) => (
      <MacroCard
        label={item.label}
        icon={item.icon}
        color={item.color}
        onPress={() => handlePress(item.action)}
      />
    ),
    [handlePress],
  );

  return (
    <FlatList
      data={MACRO_ACTIONS}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      numColumns={3}
      scrollEnabled={false}
      contentContainerStyle={styles.grid}
    />
  );
};

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const styles = StyleSheet.create({
  grid: {
    paddingVertical: 8,
  },
  card: {
    flex: 1,
    margin: 5,
    paddingVertical: 14,
    paddingHorizontal: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 5,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});

export default MacroGrid;
