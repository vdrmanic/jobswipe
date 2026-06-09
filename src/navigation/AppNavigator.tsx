import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import CandidateSetupScreen from '../screens/setup/CandidateSetupScreen';
import CompanySetupScreen from '../screens/setup/CompanySetupScreen';
import MainTabs from './MainTabs';

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
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#6C63FF" />
      <Text style={{ color: '#888', marginTop: 12 }}>Učitavanje...</Text>
    </View>
  );
}

function MissingProfileScreen() {
  const { signOut, refreshProfile } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 12 }}>
        Profil nije pronađen
      </Text>

      <Text style={{ color: '#888', textAlign: 'center', marginBottom: 24 }}>
        Nalog postoji, ali profil nije pronađen u tabeli profiles.
      </Text>

      <TouchableOpacity
        onPress={refreshProfile}
        style={{ backgroundColor: '#6C63FF', padding: 16, borderRadius: 12, marginBottom: 12 }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Pokušaj ponovo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={signOut}
        style={{ backgroundColor: '#222', padding: 16, borderRadius: 12 }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Odjavi se</Text>
      </TouchableOpacity>
    </View>
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