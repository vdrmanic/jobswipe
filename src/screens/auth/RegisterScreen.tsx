import { useState } from 'react';
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
import { useAuth } from '../../hooks/useAuth';
import { UserType } from '../../types';

export default function RegisterScreen({ navigation }: any) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [userType, setUserType] = useState<UserType>('candidate');
  const [loading, setLoading] = useState(false);

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

    Alert.alert(
      'Uspeh',
      'Nalog je kreiran. Ako je potrebna verifikacija, proveri inbox. Ako ne, prijavi se.'
    );

    navigation.navigate('Login');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Kreiraj nalog</Text>
        <Text style={styles.subtitle}>Odaberi tip naloga</Text>

        <View style={styles.typeContainer}>
          <TouchableOpacity
            style={[styles.typeButton, userType === 'candidate' && styles.typeButtonActive]}
            onPress={() => setUserType('candidate')}
          >
            <Text style={styles.typeEmoji}>👤</Text>
            <Text style={[styles.typeText, userType === 'candidate' && styles.typeTextActive]}>
              Tražim posao
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeButton, userType === 'company' && styles.typeButtonActive]}
            onPress={() => setUserType('company')}
          >
            <Text style={styles.typeEmoji}>🏢</Text>
            <Text style={[styles.typeText, userType === 'company' && styles.typeTextActive]}>
              Tražim radnike
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder={userType === 'candidate' ? 'Ime i prezime' : 'Vaše ime'}
          placeholderTextColor="#999"
          value={fullName}
          onChangeText={setFullName}
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Lozinka"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Registruj se</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>
            Već imaš nalog? <Text style={styles.linkBold}>Prijavi se</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 24 },
  typeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  typeButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  typeButtonActive: { borderColor: '#6C63FF', backgroundColor: '#1a1633' },
  typeEmoji: { fontSize: 32, marginBottom: 8 },
  typeText: { color: '#888', fontWeight: '600', textAlign: 'center' },
  typeTextActive: { color: '#6C63FF' },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  link: { color: '#888', textAlign: 'center', fontSize: 14 },
  linkBold: { color: '#6C63FF', fontWeight: 'bold' },
});