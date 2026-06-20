import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { ExperienceItem } from '../../types';
import PositionPicker from '../../components/PositionPicker';

export default function EditProfileScreen({ navigation }: any) {
  const { user, profile, refreshProfile } = useAuth();

  const isCompany = profile?.user_type === 'company';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [position, setPosition] = useState('');
  const [skills, setSkills] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [website, setWebsite] = useState('');

  const [expCompany, setExpCompany] = useState('');
  const [expPosition, setExpPosition] = useState('');
  const [expDuration, setExpDuration] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [experienceItems, setExperienceItems] = useState<ExperienceItem[]>([]);

  const fetchData = async () => {
    if (!user || !profile) return;

    setLoading(true);

    setFullName(profile.full_name || '');
    setLocation(profile.location || '');
    setBio(profile.bio || '');
    setAvatarUrl(profile.avatar_url || null);
    const table = isCompany ? 'company_profiles' : 'candidate_profiles';

    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (isCompany) {
      setCompanyName(data?.company_name || '');
      setIndustry(data?.industry || '');
      setCompanySize(data?.company_size || '');
      setWebsite(data?.website || '');
    } else {
      setPosition(data?.position || '');
      setSkills((data?.skills || []).join(', '));
      setExperienceItems(data?.experience_items || []);
    }

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [user?.id, profile?.user_type])
  );

  const addExperience = () => {
    if (!expCompany.trim() || !expPosition.trim() || !expDuration.trim()) {
      Alert.alert('Greška', 'Unesi poziciju i trajanje iskustva');
      return;
    }

    setExperienceItems([
      ...experienceItems,
      {
        company: expCompany.trim(),
        position: expPosition.trim(),
        duration: expDuration.trim(),
        description: expDescription.trim(),
      },
    ]);

    setExpCompany('');
    setExpPosition('');
    setExpDuration('');
    setExpDescription('');
  };

  const removeExperience = (index: number) => {
    setExperienceItems(experienceItems.filter((_, i) => i !== index));
  };
const pickAndUploadImage = async () => {
  if (!user) return;

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert('Greška', 'Dozvoli pristup slikama da bi mogao da izabereš sliku.');
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled) return;

  try {
    setUploadingImage(true);

    const image = result.assets[0];
    const response = await fetch(image.uri);
    const blob = await response.blob();

    const fileExt = image.uri.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, blob, {
        upsert: true,
        contentType: image.mimeType || 'image/jpeg',
      });

    if (uploadError) {
      Alert.alert('Greška upload', uploadError.message);
      setUploadingImage(false);
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

    setAvatarUrl(data.publicUrl);
    setUploadingImage(false);
  } catch (e: any) {
    setUploadingImage(false);
    Alert.alert('Greška', e?.message || 'Slika nije uploadovana.');
  }
};  
  const saveProfile = async () => {
    if (!user || !profile) return;

    if (!location.trim()) {
      Alert.alert('Greška', 'Lokacija je obavezna');
      return;
    }

    if (!isCompany && !fullName.trim()) {
      Alert.alert('Greška', 'Ime i prezime je obavezno');
      return;
    }

    if (isCompany && !companyName.trim()) {
      Alert.alert('Greška', 'Naziv firme je obavezan');
      return;
    }

    setSaving(true);

    const { error: profileError } = await supabase
      .from('profiles')
        .update({
        full_name: fullName.trim() || profile.full_name,
        location: location.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl,
        })
      .eq('id', user.id);

    if (profileError) {
      Alert.alert('Greška profile', profileError.message);
      setSaving(false);
      return;
    }

    if (isCompany) {
      const { error } = await supabase
        .from('company_profiles')
        .update({
          company_name: companyName.trim(),
          industry: industry.trim(),
          company_size: companySize.trim(),
          website: website.trim(),
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Greška firma', error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from('candidate_profiles')
        .update({
          position: position.trim() || null,
          skills: skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          experience_items: experienceItems,
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Greška kandidat', error.message);
        setSaving(false);
        return;
      }
    }

    await refreshProfile();

    setSaving(false);
    Alert.alert('Uspeh', 'Profil je izmenjen!');
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <View style={styles.pageInner}>
        <Text style={styles.header}>Izmeni profil</Text>
        <View style={styles.imageBox}>
        {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
            <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>
                {isCompany ? '🏢' : '👤'}
            </Text>
            </View>
        )}

        <TouchableOpacity
            style={styles.imageButton}
            onPress={pickAndUploadImage}
            disabled={uploadingImage}
        >
            <Text style={styles.imageButtonText}>
            {uploadingImage ? 'Upload...' : isCompany ? 'Izaberi logo' : 'Izaberi sliku'}
            </Text>
        </TouchableOpacity>
        </View>

      {!isCompany && (
        <TextInput
          style={styles.input}
          placeholder="Ime i prezime"
          placeholderTextColor="#999"
          value={fullName}
          onChangeText={setFullName}
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Lokacija"
        placeholderTextColor="#999"
        value={location}
        onChangeText={setLocation}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder={isCompany ? 'Opis firme' : 'O sebi'}
        placeholderTextColor="#999"
        value={bio}
        onChangeText={setBio}
        multiline
      />

      {isCompany ? (
        <>
          <Text style={styles.sectionTitle}>Podaci firme</Text>

          <TextInput
            style={styles.input}
            placeholder="Naziv firme"
            placeholderTextColor="#999"
            value={companyName}
            onChangeText={setCompanyName}
          />

          <TextInput
            style={styles.input}
            placeholder="Industrija"
            placeholderTextColor="#999"
            value={industry}
            onChangeText={setIndustry}
          />

          <TextInput
            style={styles.input}
            placeholder="Veličina firme"
            placeholderTextColor="#999"
            value={companySize}
            onChangeText={setCompanySize}
          />

          <TextInput
            style={styles.input}
            placeholder="Website"
            placeholderTextColor="#999"
            value={website}
            onChangeText={setWebsite}
          />
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Podaci kandidata</Text>

          <PositionPicker
            placeholder="Pozicija koju tražiš, opciono"
            value={position}
            onChange={setPosition}
          />

          <TextInput
            style={styles.input}
            placeholder="Veštine, odvojene zarezom"
            placeholderTextColor="#999"
            value={skills}
            onChangeText={setSkills}
          />

          <Text style={styles.sectionTitle}>Iskustvo</Text>

          {experienceItems.map((item, index) => (
            <View key={index} style={styles.expCard}>
              {!!item.company && <Text style={styles.expCompany}>{item.company}</Text>}
              <Text style={styles.expTitle}>{item.position}</Text>
              <Text style={styles.expDuration}>{item.duration}</Text>
              {!!item.description && <Text style={styles.expDesc}>{item.description}</Text>}

              <TouchableOpacity onPress={() => removeExperience(index)}>
                <Text style={styles.removeText}>Ukloni</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TextInput
            style={styles.input}
            placeholder="Firma u kojoj si radio"
            placeholderTextColor="#999"
            value={expCompany}
            onChangeText={setExpCompany}
          />

          <PositionPicker
            placeholder="Pozicija iskustva"
            value={expPosition}
            onChange={setExpPosition}
          />

          <TextInput
            style={styles.input}
            placeholder="Trajanje iskustva"
            placeholderTextColor="#999"
            value={expDuration}
            onChangeText={setExpDuration}
          />

          <TextInput
            style={[styles.input, styles.textAreaSmall]}
            placeholder="Opis iskustva"
            placeholderTextColor="#999"
            value={expDescription}
            onChangeText={setExpDescription}
            multiline
          />

          <TouchableOpacity style={styles.secondaryButton} onPress={addExperience}>
            <Text style={styles.secondaryButtonText}>+ Dodaj iskustvo</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Sačuvaj izmene</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Nazad</Text>
      </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  inner: { padding: 24, paddingTop: 60, paddingBottom: 110, alignItems: 'center' },
  pageInner: {
    width: '100%',
    maxWidth: 760,
    alignItems: 'center',
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 12, marginBottom: 14 },
  input: {
    width: '100%',
    maxWidth: 720,
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
  textAreaSmall: { minHeight: 80, textAlignVertical: 'top' },
  expCard: {
    backgroundColor: '#151515',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  imageBox: {
    width: '100%',
    maxWidth: 720,
    alignItems: 'center',
    marginBottom: 24,
  },
avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 12,
  },
avatarPlaceholder: {
  width: 110,
  height: 110,
  borderRadius: 55,
  backgroundColor: '#151515',
  borderColor: '#333',
  borderWidth: 1,
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 12,
},
avatarPlaceholderText: {
  fontSize: 42,
},
imageButton: {
  backgroundColor: '#222',
  borderRadius: 12,
  paddingVertical: 12,
  paddingHorizontal: 18,
},
imageButtonText: {
  color: '#fff',
  fontWeight: 'bold',
},
  expTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  expCompany: { color: '#a8b2ff', fontSize: 13, fontWeight: '800', marginBottom: 4 },
  expDuration: { color: '#6C63FF', marginTop: 4 },
  expDesc: { color: '#aaa', marginTop: 8, lineHeight: 20 },
  removeText: { color: '#ff5c5c', fontWeight: 'bold', marginTop: 10 },
  secondaryButton: {
    borderColor: '#6C63FF',
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 14,
  },
  secondaryButtonText: { color: '#6C63FF', fontWeight: 'bold' },
  saveButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  backButton: { padding: 16, alignItems: 'center', marginTop: 8 },
  backButtonText: { color: '#888', fontWeight: 'bold' },
});
