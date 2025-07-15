/**
 * TabNavigator - Bottom Tab Navigation
 * 
 * LEARNING NOTES: Bottom Tab Navigation Patterns
 * 
 * Bottom tabs are the primary navigation pattern for mobile apps:
 * 1. Always visible - Users can switch between main sections anytime
 * 2. 3-5 tabs maximum - Keeps interface clean and usable
 * 3. Icons + labels - Clear visual hierarchy and recognition
 * 4. Active states - Shows current section with color/style changes
 * 5. Badge support - Can show notifications or counts
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';

// Icons for tabs - we'll use text icons for now, can upgrade to vector icons later
import { Ionicons } from '@expo/vector-icons';

// Import screen components (we'll create these next)
import { HomeScreen } from '../screens/HomeScreen';
import { PredictionsScreen } from '../screens/PredictionsScreen';
import { PortfolioScreen } from '../screens/PortfolioScreen';
import { CommunityScreen } from '../screens/CommunityScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

/**
 * LEARNING NOTE: Tab Navigation Type Safety
 * Define the structure of each tab and its parameters
 */
export type TabParamList = {
  Home: undefined;
  Predictions: undefined;
  Portfolio: undefined;
  Community: undefined;
  Profile: undefined;
};

// Create the Tab Navigator instance
const Tab = createBottomTabNavigator<TabParamList>();

/**
 * TabNavigator Component
 * 
 * LEARNING NOTE: Tab Configuration
 * Each Tab.Screen configures a bottom tab with:
 * - name: Unique identifier for the tab
 * - component: React component to render
 * - options: Visual configuration (icon, label, colors, etc.)
 */
export const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        // Global tab bar styling
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 5, // Account for iPhone home indicator
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 85 : 65,
        },
        
        // Global tab item styling
        tabBarActiveTintColor: '#3b82f6', // Blue for active tab
        tabBarInactiveTintColor: '#64748b', // Gray for inactive tabs
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 2,
        },
        
        // Hide default headers - each screen will handle its own
        headerShown: false,
      }}
    >
      {/* 
        Home Tab - Landing page with featured content
      */}
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      
      {/* 
        Predictions Tab - AI predictions dashboard
      */}
      <Tab.Screen 
        name="Predictions" 
        component={PredictionsScreen}
        options={{
          tabBarLabel: 'Predictions',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics-outline" size={size} color={color} />
          ),
        }}
      />
      
      {/* 
        Portfolio Tab - Investment tracker
      */}
      <Tab.Screen 
        name="Portfolio" 
        component={PortfolioScreen}
        options={{
          tabBarLabel: 'Portfolio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up-outline" size={size} color={color} />
          ),
        }}
      />
      
      {/* 
        Community Tab - Chat and comments
      */}
      <Tab.Screen 
        name="Community" 
        component={CommunityScreen}
        options={{
          tabBarLabel: 'Community',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      
      {/* 
        Profile Tab - User account management
      */}
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

/**
 * LEARNING NOTES: Tab Navigation Best Practices
 * 
 * 1. **Consistent Icons**: Use the same icon style (outline vs filled)
 * 2. **Meaningful Labels**: Short, descriptive text that matches functionality
 * 3. **Color Hierarchy**: Active vs inactive states should be clearly different
 * 4. **Platform Awareness**: Different padding/sizing for iOS vs Android
 * 5. **Accessibility**: Icons and labels work together for screen readers
 * 6. **State Management**: Tab navigator maintains its own navigation state
 * 7. **Deep Linking**: Each tab can have its own URL for web compatibility
 */