import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function ResetPasswordScreen({ navigation }: any) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Greska', 'Unesi email adresu');
      return;
    }

    setLoading(true);

    try {
      const { error } = await resetPassword(email.trim());
      if (error) {
        Alert.alert('Greska', error.message);
        return;
      }

      Alert.alert('Proveri email', 'Poslali smo link za reset lozinke. Proveri inbox.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Greska', e?.message || 'Doslo je do problema pri slanju emaila.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[COLORS.dark, '#111827', '#201335']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inner}>
          <View style={styles.iconBox}>
            <Ionicons name="key" size={30} color={COLORS.primarySoft} />
          </View>
          <Text style={styles.title}>Reset lozinke</Text>
          <Text style={styles.subtitle}>Unesi email i poslacemo ti link za povratak u nalog.</Text>

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
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Posalji link</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.link}>Nazad na prijavu</Text>
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
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
  },
  title: { fontSize: 34, fontWeight: '900', color: COLORS.white, textAlign: 'center' },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 26,
  },
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
  },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
  link: { color: COLORS.textMuted, textAlign: 'center', fontSize: 15, marginTop: 22, fontWeight: '800' },
});
