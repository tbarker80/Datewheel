import { ProProvider } from '@/components/ProContext';
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Global handler — index.tsx will register itself here
export let handleIncomingDatewheelFile: ((data: string) => void) | null = null;
export function registerDatewheelHandler(fn: (data: string) => void) {
  handleIncomingDatewheelFile = fn;
}

async function processUrl(url: string) {
  try {
    // Handle datewheel:// scheme
    if (url.startsWith('datewheel://')) {
      const encoded = url.replace('datewheel://', '');
      const decoded = decodeURIComponent(encoded);
      if (handleIncomingDatewheelFile) {
        handleIncomingDatewheelFile(decoded);
      }
      return;
    }

    // Handle file:// or content:// URIs for .datewheel files
    if (url.includes('.datewheel') || url.startsWith('content://') || url.startsWith('file://')) {
      const content = await FileSystem.readAsStringAsync(url);
      if (handleIncomingDatewheelFile) {
        handleIncomingDatewheelFile(content);
      }
    }
  } catch (e) {
    console.log('Error processing incoming file:', e);
  }
}

export default function RootLayout() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Handle URL when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      processUrl(url);
    });

    // Handle URL when app is opened from cold start
    Linking.getInitialURL().then(url => {
      if (url) processUrl(url);
    });

    // Handle app state changes
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        Linking.getInitialURL().then(url => {
          if (url) processUrl(url);
        });
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ProProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ProProvider>
    </GestureHandlerRootView>
  );
}