import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import { UserType } from '../../types';

export default function RegisterScreen({ navigation }: any) {
  const { signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [userType, setUserType] = useState<UserType>('candidate');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleRegister = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedFullName = fullName.trim();

    if (!trimmedEmail || !trimmedPassword || !trimmedFullName) {
      Alert.alert('Greška', 'Popunite sva polja');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Greška', 'Unesi validan email');
      return;
    }

    if (trimmedPassword.length < 8) {
      Alert.alert('Greška', 'Lozinka mora imati najmanje 8 karaktera');
      return;
    }

    if (trimmedFullName.length < 3) {
      Alert.alert('Greška', 'Unesi puno ime i prezime');
      return;
    }

    setLoading(true);
    const { error } = await signUp(trimmedEmail, trimmedPassword, trimmedFullName, userType);
    setLoading(false);

    if (error) {
      Alert.alert('Greška', error.message);
      return;
    }

    Alert.alert('Uspeh', 'Nalog je kreiran. Ako je potrebna verifikacija, proveri inbox.');
    navigation.navigate('Login');
  };

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle(userType);
    setGoogleLoading(false);

    if (error) {
      Alert.alert('Google registracija', error.message);
    }
  };

  return (
    <LinearGradient colors={[COLORS.dark, '#10131D', '#16243B']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Kreiraj nalog</Text>
          <Text style={styles.subtitle}>Izaberi stranu tržišta i napravi profil koji može da mečuje.</Text>

          <View style={styles.typeContainer}>
            <TypeOption
              active={userType === 'candidate'}
              icon="person"
              title="Kandidat"
              subtitle="Tražim posao"
              onPress={() => setUserType('candidate')}
            />
            <TypeOption
              active={userType === 'company'}
              icon="business"
              title="Firma"
              subtitle="Tražim radnike"
              onPress={() => setUserType('company')}
            />
          </View>

          <View style={styles.card}>
            <Field icon="person-outline">
              <TextInput
                style={styles.input}
                placeholder={userType === 'candidate' ? 'Ime i prezime' : 'Vaše ime'}
                placeholderTextColor={COLORS.lightGray}
                value={fullName}
                onChangeText={setFullName}
                maxLength={INPUT_LIMITS.fullName}
              />
            </Field>
            <Field icon="mail-outline">
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
            </Field>
            <Field icon="lock-closed-outline">
              <TextInput
                style={styles.input}
                placeholder="Lozinka"
                placeholderTextColor={COLORS.lightGray}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                maxLength={INPUT_LIMITS.password}
              />
            </Field>

            <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Registruj se</Text>}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ili</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleRegister} disabled={googleLoading}>
              {googleLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color={COLORS.white} />
                  <Text style={styles.googleButtonText}>Registruj se preko Google-a</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}>
              Već imaš nalog? <Text style={styles.linkBold}>Prijavi se</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function Field({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={20} color={COLORS.textMuted} />
      {children}
    </View>
  );
}

function TypeOption({
  active,
  icon,
  title,
  subtitle,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.typeButton, active && styles.typeButtonActive]} onPress={onPress}>
      <Ionicons name={icon} size={26} color={active ? COLORS.primarySoft : COLORS.textMuted} />
      <Text style={[styles.typeTitle, active && styles.typeTextActive]}>{title}</Text>
      <Text style={styles.typeSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 44 },
  title: { fontSize: 36, fontWeight: '900', color: COLORS.white, textAlign: 'center' },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 24,
  },
  typeContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  typeButton: {
    flex: 1,
    minHeight: 118,
    backgroundColor: COLORS.glass,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    gap: 6,
  },
  typeButtonActive: {
    backgroundColor: 'rgba(124, 92, 255, 0.20)',
    borderColor: COLORS.primary,
  },
  typeTitle: { color: COLORS.white, fontWeight: '900', fontSize: 16 },
  typeSubtitle: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  typeTextActive: { color: COLORS.primarySoft },
  card: {
    backgroundColor: 'rgba(16, 19, 29, 0.88)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    gap: 14,
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
  link: { color: COLORS.textMuted, textAlign: 'center', fontSize: 15, marginTop: 22 },
  linkBold: { color: COLORS.primarySoft, fontWeight: '900' },
});
