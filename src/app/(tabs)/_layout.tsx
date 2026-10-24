import { Tabs } from 'expo-router';

import { IconSymbol } from '@/components/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.neutralFillAlt,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabel: ({ color, children }) => (
          <ThemedText type="small" style={{ color }}>
            {children}
          </ThemedText>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol name="house.fill" size={24} color={color} />,
        }}
      />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color }) => <IconSymbol name="map" size={24} color={color} /> }} />
      <Tabs.Screen
        name="calm-guide"
        options={{
          title: 'My trip',
          tabBarIcon: ({ color }) => <IconSymbol name="map.fill" size={24} color={color} />,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <IconSymbol name="person.crop.circle" size={24} color={color} /> }} />
    </Tabs>
  );
}
