import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';

import { HapticTab } from '../../components/HapticTab';
import { IconSymbol } from '../../components/ui/IconSymbol';
import TabBarBackground from '../../components/ui/TabBarBackground';

import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// import { Colors } from '@/constants/Colors';
// import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  // const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        // tabBarActiveTintColor: '#0b0809',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: () => (<View style={{ flex: 1, backgroundColor: '#c3c3c3' }}></View>),
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'ao vivo',
          tabBarIcon: ({ color }) => <MaterialIcons size={28} name="videocam" color={color} />,
        }}
      />
      <Tabs.Screen
        name="videosScreen"
        options={{
          title: 'videos',
          tabBarIcon: ({ color }) =>
            <MaterialIcons name="video-collection" size={28} color={color} />
          // tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
