/**
 * DiamondInsights Mobile App - Entry Point
 * 
 * LEARNING NOTES: App Architecture with Navigation
 * 1. This demonstrates React Navigation setup
 * 2. AppNavigator handles all navigation logic
 * 3. StatusBar configuration for mobile
 * 4. Clean separation of navigation and app logic
 */

import { StatusBar } from 'expo-status-bar';

// Import our navigation system
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <>
      {/* Main Navigation Container */}
      <AppNavigator />
      
      {/* Status Bar Configuration */}
      <StatusBar style="auto" />
    </>
  );
}

