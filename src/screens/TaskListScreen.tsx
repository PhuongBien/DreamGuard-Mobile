// ============================================================
// TaskListScreen — Production Version (Android Ready)
// ============================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  RefreshControl,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TaskStackParamList } from '../types/navigation';

import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
  TaskTypeConfig,
} from '../constants/theme';

import { Task, TaskStatus } from '../types';
import {
  StatusBadge,
  PriorityBadge,
  TaskTypeBadge,
  EmptyState,
} from '../components/shared';

import { MOCK_TASKS } from '../utils/mockData';

// ================= TYPES =================

type ScreenProps = NativeStackScreenProps<
  TaskStackParamList,
  'TaskList'
>;

type ExtraProps = {
  filter: 'all' | TaskStatus;
  onFilterChange: (value: 'all' | TaskStatus) => void;
  onCountChange: (count: number) => void;
};

type Props = ScreenProps & ExtraProps;

// ================= FILTER LIST =================

const STATUS_FILTERS: { key: TaskStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'on_hold', label: 'On Hold' },
];

// ================= COMPONENT =================

export default function TaskListScreen({
  navigation,
  filter,
  onFilterChange,
  onCountChange,
}: Props) {
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // ================= FILTER LOGIC =================

  const filteredTasks = useMemo(() => {
    return MOCK_TASKS.filter(task => {
      const matchStatus =
        filter === 'all' || task.status === filter;

      const q = searchText.toLowerCase();
      const matchSearch =
        !q ||
        task.title.toLowerCase().includes(q) ||
        task.taskCode.toLowerCase().includes(q) ||
        task.customer.name.toLowerCase().includes(q);

      return matchStatus && matchSearch;
    });
  }, [filter, searchText]);

  // 🔥 Update badge count in header
  useEffect(() => {
    onCountChange(filteredTasks.length);
  }, [filteredTasks]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // ================= RENDER TASK =================

  const renderTask = ({ item }: { item: Task }) => {
    const typeConfig = TaskTypeConfig[item.type];

    return (
      <TouchableOpacity
        style={styles.taskCard}
        onPress={() =>
          navigation.navigate('TaskDetail', { taskId: item.id })
        }
        activeOpacity={0.85}
      >
        <View style={styles.taskContent}>
          <View style={styles.taskTopRow}>
            <Text style={styles.taskCode}>{item.taskCode}</Text>
            <StatusBadge status={item.status} size="sm" />
          </View>

          <Text style={styles.taskTitle} numberOfLines={2}>
            {item.title}
          </Text>

          <View style={styles.badgeRow}>
            <TaskTypeBadge type={item.type} />
            <PriorityBadge priority={item.priority} />
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
  };

  // ================= UI =================

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.primary900}
      />

      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={18}
          color={Colors.gray400}
          style={{ marginRight: 6 }}
        />
        <TextInput
          placeholder="Find tasks..."
          placeholderTextColor={Colors.gray400}
          value={searchText}
          onChangeText={setSearchText}
          style={styles.searchInput}
        />
      </View>

      {/* FILTER CHIPS */}
      <View style={styles.filterContainer}>
        {STATUS_FILTERS.map(filterItem => {
          const active = filter === filterItem.key;

          return (
            <TouchableOpacity
              key={filterItem.key}
              style={[
                styles.filterChip,
                active && styles.filterChipActive,
              ]}
              onPress={() => onFilterChange(filterItem.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  active && styles.filterTextActive,
                ]}
              >
                {filterItem.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* LIST */}
      <FlatList
        data={filteredTasks}
        keyExtractor={t => t.id}
        renderItem={renderTask}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary700]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={
              <Ionicons
                name="clipboard-outline"
                size={48}
                color={Colors.gray300}
              />
            }
            title="No tasks found"
            subtitle="Try changing filter or search."
          />
        }
      />
    </SafeAreaView>
  );
}

// ================= STYLES =================

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.base,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.base,
    ...Shadow.sm,
  },

  searchInput: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.gray800,
  },

  filterContainer: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
  },

  filterChip: {
    height: 38,
    minWidth: 80,
    paddingHorizontal: 16,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    marginRight: 10,
  },

  filterChipActive: {
    backgroundColor: Colors.primary700,
  },

  filterText: {
    fontSize: Typography.sm,
    color: Colors.gray600,
    fontWeight: '600',
  },

  filterTextActive: {
    color: Colors.white,
  },

  listContent: {
    padding: Spacing.base,
    paddingBottom: Spacing['2xl'],
  },

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
  },

  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
});