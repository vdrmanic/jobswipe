import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import CandidateSetupScreen from '../screens/setup/CandidateSetupScreen';
import CompanySetupScreen from '../screens/setup/CompanySetupScreen';
import MainTabs from './MainTabs';
import { COLORS } from '../constants';

const Stack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

function LoadingScreen() {
  return (
    <LinearGradient
      colors={[COLORS.dark, '#10131D', '#18102B']}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
    >
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 28,
          backgroundColor: COLORS.glass,
          borderWidth: 1,
          borderColor: COLORS.border,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 18,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primarySoft} />
      </View>
      <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>Učitavanje...</Text>
    </LinearGradient>
  );
}

function MissingProfileScreen() {
  const { signOut, refreshProfile } = useAuth();

  return (
    <LinearGradient
      colors={[COLORS.dark, '#111827', '#201335']}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}
    >
      <Text style={{ color: COLORS.white, fontSize: 24, fontWeight: '900', marginBottom: 12 }}>
        Profil nije pronađen
      </Text>

      <Text style={{ color: COLORS.textMuted, textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
        Nalog postoji, ali profil nije pronađen u tabeli profiles.
      </Text>

      <TouchableOpacity
        onPress={refreshProfile}
        style={{ backgroundColor: COLORS.primary, padding: 16, borderRadius: 16, marginBottom: 12, minWidth: 190, alignItems: 'center' }}
      >
        <Text style={{ color: COLORS.white, fontWeight: '900' }}>Pokušaj ponovo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={signOut}
        style={{ backgroundColor: COLORS.glass, padding: 16, borderRadius: 16, minWidth: 190, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}
      >
        <Text style={{ color: COLORS.white, fontWeight: '900' }}>Odjavi se</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

function AppStack() {
  const { profile } = useAuth();

  if (!profile) {
    return <MissingProfileScreen />;
  }

  const needsSetup = !profile.location;

  if (needsSetup && profile.user_type === 'candidate') {
    return <CandidateSetupScreen />;
  }

  if (needsSetup && profile.user_type === 'company') {
    return <CompanySetupScreen />;
  }

  return <MainTabs />;
}

export default function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {session ? <AppStack /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
