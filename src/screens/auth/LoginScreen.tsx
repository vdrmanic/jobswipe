import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../constants';
import { INPUT_LIMITS } from '../../constants/inputLimits';
const appIcon = require('../../../assets/icon.png');

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Greška', 'Unesite email i lozinku');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);

    if (error) {
      Alert.alert('Greška', error.message);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);

    if (error) {
      Alert.alert('Google prijava', error.message);
    }
  };

  return (
    <LinearGradient colors={[COLORS.dark, '#111827', '#25133B']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inner}>
          <View style={styles.brandMark}>
            <Image source={appIcon} style={styles.brandIcon} resizeMode="cover" />
          </View>
          <Text style={styles.title}>JobHop</Text>
          <Text style={styles.subtitle}>Swajpuj pametnije. Upoznaj posao koji stvarno ima smisla.</Text>

          <View style={styles.card}>
            <View style={styles.field}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={COLORS.lightGray}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={INPUT_LIMITS.email}
              />
            </View>

            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Lozinka"
                placeholderTextColor={COLORS.lightGray}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                maxLength={INPUT_LIMITS.password}
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Text style={styles.buttonText}>Prijavi se</Text>
                  <Ionicons name="arrow-forward" size={19} color={COLORS.white} />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ili</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin} disabled={googleLoading}>
              {googleLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color={COLORS.white} />
                  <Text style={styles.googleButtonText}>Prijavi se preko Google-a</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('ResetPassword')}>
              <Text style={styles.link}>Zaboravio/la si lozinku?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}>
              Nemaš nalog? <Text style={styles.linkBold}>Registruj se</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  brandMark: {
    width: 74,
    height: 74,
    borderRadius: 24,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
    overflow: 'hidden',
  },
  brandIcon: { width: 58, height: 58, borderRadius: 18 },
  title: { fontSize: 40, fontWeight: '900', color: COLORS.white, textAlign: 'center' },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 8,
    marginBottom: 28,
  },
  card: {
    backgroundColor: 'rgba(16, 19, 29, 0.88)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    gap: 14,
    boxShadow: '0px 22px 46px rgba(0, 0, 0, 0.28)',
  },
  field: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.input,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
  },
  input: { flex: 1, color: COLORS.white, fontSize: 16 },
  button: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '800' },
  googleButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  googleButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
  link: { color: COLORS.textMuted, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  footerLink: { color: COLORS.textMuted, textAlign: 'center', fontSize: 15, marginTop: 22 },
  linkBold: { color: COLORS.primarySoft, fontWeight: '900' },
});
