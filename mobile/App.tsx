/**
 * DiamondInsights Mobile App - Entry Point
 * 
 * LEARNING NOTES: App Architecture with Context and Navigation
 * 1. AuthProvider wraps the entire app for global auth state
 * 2. AppNavigator handles all navigation logic
 * 3. StatusBar configuration for mobile
 * 4. Clean separation of authentication and navigation logic
 */

import { StatusBar } from 'expo-status-bar';

// Import our navigation system and context providers
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthProvider } from './src/contexts/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      {/* Main Navigation Container */}
      <AppNavigator />
      
      {/* Status Bar Configuration */}
      <StatusBar style="auto" />
    </AuthProvider>
  );
}

