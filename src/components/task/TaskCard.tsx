import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
  TaskTypeConfig,
} from '../../constants/theme';

import { Task } from '../../types';
import {
  StatusBadge,
  PriorityBadge,
  TaskTypeBadge,
} from '../shared';

interface TaskCardProps {
  task: Task;
  onPress: () => void;
}

export default function TaskCard({ task, onPress }: TaskCardProps) {
  const typeConfig = TaskTypeConfig[task.type];

  return (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.taskContent}>
        <View style={styles.taskTopRow}>
          <Text style={styles.taskCode}>{task.taskCode}</Text>
          <StatusBadge status={task.status} size="sm" />
        </View>

        <Text style={styles.taskTitle} numberOfLines={2}>
          {task.title}
        </Text>

        <View style={styles.badgeRow}>
          <TaskTypeBadge type={task.type} />
          <PriorityBadge priority={task.priority} />
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={Colors.gray300}
        style={{ marginRight: 12, alignSelf: 'center' }}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  taskCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    ...Shadow.base,
  },

  taskContent: {
    flex: 1,
    padding: 12,
  },

  taskTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  taskCode: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.gray400,
  },

  taskTitle: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.gray900,
    marginBottom: 8,
  },

  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});