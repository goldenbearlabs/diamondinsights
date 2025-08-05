/**
 * AboutScreen - App Information and Legal Documents
 * 
 * LEARNING NOTES: About Screen Implementation
 * 
 * This screen demonstrates:
 * 1. App information display (version, description)
 * 2. Legal document access (Terms of Service, Privacy Policy)
 * 3. External URL opening with proper error handling
 * 4. Consistent design with other screens
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { theme } from '../styles/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type AboutScreenNavigationProp = StackNavigationProp<RootStackParamList, 'About'>;

export const AboutScreen: React.FC = () => {
  const navigation = useNavigation<AboutScreenNavigationProp>();

  /**
   * Open Terms of Service in browser
   */
  const handleTermsPress = async () => {
    const termsUrl = 'https://diamondinsights.vercel.app/terms';
    try {
      const supported = await Linking.canOpenURL(termsUrl);
      if (supported) {
        await Linking.openURL(termsUrl);
      } else {
        Alert.alert(
          'Terms of Service',
          'Unable to open browser. Please visit diamondinsights.vercel.app/terms in your web browser.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening terms URL:', error);
      Alert.alert(
        'Terms of Service',
        'Unable to open browser. Please visit diamondinsights.vercel.app/terms in your web browser.',
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * Open Privacy Policy in browser
   */
  const handlePrivacyPress = async () => {
    const privacyUrl = 'https://diamondinsights.vercel.app/privacy';
    try {
      const supported = await Linking.canOpenURL(privacyUrl);
      if (supported) {
        await Linking.openURL(privacyUrl);
      } else {
        Alert.alert(
          'Privacy Policy',
          'Unable to open browser. Please visit diamondinsights.vercel.app/privacy in your web browser.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening privacy URL:', error);
      Alert.alert(
        'Privacy Policy',
        'Unable to open browser. Please visit diamondinsights.vercel.app/privacy in your web browser.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>About</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* App Info Section */}
        <View style={styles.section}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/diamond_icon.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          
          <Text style={styles.appName}>DiamondInsights</Text>
          <Text style={styles.appVersion}>Mobile App v1.0.0</Text>
          <Text style={styles.appDescription}>
            AI-powered predictions and investment tracking for MLB The Show players. 
            Get insights on player rating changes and manage your virtual portfolio.
          </Text>
        </View>

        {/* Legal Documents Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal & Privacy</Text>
          
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleTermsPress}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.text.primary} />
              <Text style={styles.actionButtonText}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handlePrivacyPress}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.text.primary} />
              <Text style={styles.actionButtonText}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Developer</Text>
            <Text style={styles.infoValue}>DiamondInsights Team</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Contact</Text>
            <Text style={styles.infoValue}>diamondinsights25@gmail.com</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Website</Text>
            <Text style={styles.infoValue}>diamondinsights.app</Text>
          </View>
        </View>

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.dark,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.colors.background.medium,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  
  headerSpacer: {
    width: 40,
  },
  
  scrollContainer: {
    flex: 1,
  },
  
  section: {
    backgroundColor: theme.colors.surface.elevated,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  
  logo: {
    width: 80,
    height: 80,
  },
  
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  
  appVersion: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  
  appDescription: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 16,
  },
  
  actionButton: {
    backgroundColor: theme.colors.background.medium,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  actionButtonText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    fontWeight: '500',
    flex: 1,
  },
  
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.secondary,
  },
  
  infoLabel: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  
  infoValue: {
    fontSize: 16,
    color: theme.colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  
  bottomPadding: {
    height: 20,
  },
});