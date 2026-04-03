import { Stack } from 'expo-router';
import React from 'react';

export default function StackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTintColor: '#1a1a1a',
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: true,
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Câmeras ao Vivo',
        }}
      />
      <Stack.Screen
        name="videosScreen"
        options={{
          title: 'Health Monitor',
        }}
      />
    </Stack>
  );
}
