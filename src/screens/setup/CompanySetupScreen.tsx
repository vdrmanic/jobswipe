import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

export default function CompanySetupScreen() {
  const { user, refreshProfile } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  const saveProfile = async () => {
    if (!user) return;

    if (!companyName.trim() || !location.trim()) {
      Alert.alert('Greška', 'Unesi naziv firme i lokaciju');
      return;
    }

    setLoading(true);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        location: location.trim(),
        bio: bio.trim(),
      })
      .eq('id', user.id);

    if (profileError) {
      Alert.alert('Greška', profileError.message);
      setLoading(false);
      return;
    }

    const { error: companyError } = await supabase
      .from('company_profiles')
      .update({
        company_name: companyName.trim(),
        industry: industry.trim(),
        company_size: companySize.trim(),
        website: website.trim(),
      })
      .eq('id', user.id);

    if (companyError) {
      Alert.alert('Greška', companyError.message);
      setLoading(false);
      return;
    }

    await refreshProfile();
    setLoading(false);
    Alert.alert('Uspeh', 'Profil firme je sačuvan!');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.title}>Profil firme 🏢</Text>
      <Text style={styles.subtitle}>Ovo će kandidati videti kada swajpuju poslove.</Text>

      <TextInput style={styles.input} placeholder="Naziv firme" placeholderTextColor="#999" value={companyName} onChangeText={setCompanyName} />
      <TextInput style={styles.input} placeholder="Industrija" placeholderTextColor="#999" value={industry} onChangeText={setIndustry} />
      <TextInput style={styles.input} placeholder="Veličina firme npr. 10-50" placeholderTextColor="#999" value={companySize} onChangeText={setCompanySize} />
      <TextInput style={styles.input} placeholder="Website" placeholderTextColor="#999" value={website} onChangeText={setWebsite} />
      <TextInput style={styles.input} placeholder="Lokacija" placeholderTextColor="#999" value={location} onChangeText={setLocation} />
      <TextInput style={[styles.input, styles.textArea]} placeholder="Opis firme" placeholderTextColor="#999" value={bio} onChangeText={setBio} multiline />

      <TouchableOpacity style={styles.button} onPress={saveProfile} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sačuvaj profil firme</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  inner: { padding: 24, paddingTop: 60 },
  title: { color: '#fff', fontSize: 30, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 15, marginBottom: 28 },
  input: {
    backgroundColor: '#1a1a1a',
    borderColor: '#333',
    borderWidth: 1,
    color: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 14,
    fontSize: 16,
  },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});