import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { defaultStackOptions } from './navigationOptions';
import { TaskStackParamList } from '../types/navigation';

import TaskListScreen from '../screens/TaskListScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import CheckInOutScreen from '../screens/CheckInOutScreen';

import { Colors } from '../constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const Stack = createNativeStackNavigator<TaskStackParamList>();

export default function TaskStackNavigator() {
  const [taskCount, setTaskCount] = useState(0);
  const [filter, setFilter] = useState<'all' | any>('all');

  return (
    <Stack.Navigator screenOptions={defaultStackOptions}>
      
      {/* ================= TASK LIST ================= */}
      <Stack.Screen
        name="TaskList"
        options={{
          title: 'Tasks',

          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              
              {/* Badge số lượng task */}
              <View
                style={{
                  backgroundColor: Colors.primary700,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  marginRight: 12,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                  {taskCount}
                </Text>
              </View>

              {/* Filter icon */}
              <TouchableOpacity
                onPress={() => {
                  // demo: cycle filter
                  if (filter === 'all') setFilter('pending');
                  else if (filter === 'pending') setFilter('completed');
                  else setFilter('all');
                }}
                style={{ padding: 6 }}
              >
                <MaterialIcons
                  name="filter-list"
                  size={24}
                  color={Colors.white}
                />
              </TouchableOpacity>
            </View>
          ),
        }}
      >
        {(props) => (
          <TaskListScreen
            {...props}
            filter={filter}
            onFilterChange={setFilter}
            onCountChange={setTaskCount}
          />
        )}
      </Stack.Screen>

      {/* ================= DETAIL ================= */}
      <Stack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ headerShown: false }}
      />

      {/* ================= CHECK IN OUT ================= */}
      <Stack.Screen
        name="CheckInOut"
        component={CheckInOutScreen}
        options={{ headerShown: true }}
      />
    </Stack.Navigator>
  );
}