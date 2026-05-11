import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F0F0F',
          borderTopColor: '#2E2E2E',
        },
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#5C5C5C',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trips',
        }}
      />
    </Tabs>
  );
}
