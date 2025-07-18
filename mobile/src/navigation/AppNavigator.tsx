/**
 * AppNavigator - Main Navigation Controller
 * 
 * LEARNING NOTES: React Navigation Architecture
 * 
 * This is the root navigator that controls the entire app's navigation flow.
 * Key concepts:
 * 1. NavigationContainer - Wraps the entire navigation tree
 * 2. Stack Navigator - Handles page-to-page navigation with back button
 * 3. Tab Navigator - Bottom tabs for main app sections
 * 4. Screen configuration - Props, options, and behavior setup
 * 5. Deep linking - URL handling for specific screens
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import our custom navigators and screens
import { TabNavigator } from './TabNavigator';
import { PlayerDetailScreen } from '../screens/PlayerDetailScreen';

/**
 * LEARNING NOTE: Navigation Type Safety
 * TypeScript types for navigation help catch errors and provide autocomplete
 */
export type RootStackParamList = {
  Main: undefined;  // Main tab navigator (no params)
  PlayerDetail: {   // Player detail screen with required params
    playerId: string;
    playerName: string;
  };
  // Future screens can be added here
  Login: undefined;
  Signup: undefined;
};

// Create the Stack Navigator instance
const Stack = createStackNavigator<RootStackParamList>();

/**
 * AppNavigator Component
 * 
 * LEARNING NOTE: Navigation Flow
 * - NavigationContainer manages navigation state and deep linking
 * - Stack.Navigator provides the overall navigation structure
 * - Each Stack.Screen represents a different page/screen
 * - screenOptions configure global navigation behavior
 */
export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{
          headerShown: false, // Hide default headers, we'll use custom ones
          gestureEnabled: true, // Enable swipe-back gesture on iOS
          animationEnabled: true, // Enable page transitions
        }}
      >
        {/* 
          Main Tab Navigator Screen
          This contains all the bottom tab screens (Home, Predictions, etc.)
        */}
        <Stack.Screen 
          name="Main" 
          component={TabNavigator}
          options={{
            headerShown: false, // Tab navigator handles its own headers
          }}
        />
        
        {/* 
          Individual Player Detail Screen
          This will be pushed on top when user taps a player card
        */}
        <Stack.Screen 
          name="PlayerDetail" 
          component={PlayerDetailScreen}
          options={{
            headerShown: false, // Hide the entire header
          }}
        />
        
        {/* Future authentication screens */}
        {/* 
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// PlayerDetailScreen is now imported and used above