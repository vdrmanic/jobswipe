import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

type ExperienceItem = {
  position: string;
  duration: string;
  description: string;
};

const skillCategories = [
  {
    key: 'it',
    label: 'IT & razvoj',
    skills: ['JavaScript', 'TypeScript', 'React', 'React Native', 'Node.js', 'Python', 'AWS', 'SQL', 'DevOps'],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    skills: ['SEO', 'Google Ads', 'Facebook Ads', 'Copywriting', 'Content marketing', 'Email marketing', 'Analitika'],
  },
  {
    key: 'sales',
    label: 'Prodaja',
    skills: ['B2B prodaja', 'Cold calling', 'CRM', 'Pregovaranje', 'Lead generation', 'Prezentacije'],
  },
  {
    key: 'usluge',
    label: 'Usluge',
    skills: ['Rad s ljudima', 'Služenje pića', 'Organizacija', 'Hotelski servis', 'Kuhinja', 'Recepcija'],
  },
  {
    key: 'other',
    label: 'Ostalo',
    skills: ['Komunikacija', 'Timwork', 'Vođenje projekata', 'Administracija', 'Logistika'],
  },
];

export default function CandidateSetupScreen() {
  const { user, refreshProfile } = useAuth();

  const [position, setPosition] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(skillCategories[0].key);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillModalVisible, setSkillModalVisible] = useState(false);
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');

  const [expPosition, setExpPosition] = useState('');
  const [expDuration, setExpDuration] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [experienceItems, setExperienceItems] = useState<ExperienceItem[]>([]);

  const [loading, setLoading] = useState(false);

  const addExperience = () => {
    if (!expPosition.trim() || !expDuration.trim()) {
      Alert.alert('Greška', 'Unesi poziciju i trajanje iskustva');
      return;
    }

    setExperienceItems([
      ...experienceItems,
      {
        position: expPosition.trim(),
        duration: expDuration.trim(),
        description: expDescription.trim(),
      },
    ]);

    setExpPosition('');
    setExpDuration('');
    setExpDescription('');
  };

  const removeExperience = (index: number) => {
    setExperienceItems(experienceItems.filter((_, i) => i !== index));
  };

  const saveProfile = async () => {
    if (!user) return;

    if (!location.trim()) {
      Alert.alert('Greška', 'Unesi lokaciju');
      return;
    }

    if (selectedSkills.length === 0) {
      Alert.alert('Greška', 'Izaberi bar jednu veštinu');
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
      Alert.alert('Greška profile', profileError.message);
      setLoading(false);
      return;
    }

    const { error: candidateError } = await supabase
      .from('candidate_profiles')
      .update({
        position: position.trim() || null,
        experience_level: null,
        skills: selectedSkills,
        experience_items: experienceItems,
      })
      .eq('id', user.id);

    if (candidateError) {
      Alert.alert('Greška candidate', candidateError.message);
      setLoading(false);
      return;
    }

    await refreshProfile();
    setLoading(false);
    Alert.alert('Uspeh', 'Profil je sačuvan!');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <View style={styles.pageInner}>
        <Text style={styles.title}>Popuni profil 👤</Text>
        <Text style={styles.subtitle}>Firme će ovo videti kada pregledaju kandidate.</Text>

      <TextInput
        style={styles.input}
        placeholder="Lokacija *"
        placeholderTextColor="#999"
        value={location}
        onChangeText={setLocation}
      />

      <TextInput
        style={styles.input}
        placeholder="Pozicija koju tražiš, opciono"
        placeholderTextColor="#999"
        value={position}
        onChangeText={setPosition}
      />

      <Text style={styles.sectionTitle}>Veštine</Text>
      <Text style={styles.sectionSubtitle}>Klikni da izabereš veštine iz popup liste.</Text>

      <TouchableOpacity style={styles.skillPickerButton} onPress={() => setSkillModalVisible(true)}>
        <Text style={styles.skillPickerTitle}>Odabrane veštine</Text>
        <Text style={styles.skillPickerSubtitle}>
          {selectedSkills.length > 0 ? selectedSkills.join(', ') : 'Klikni za otvaranje liste'}
        </Text>
      </TouchableOpacity>

      <Modal transparent animationType="fade" visible={skillModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalHeader}>Izaberi veštine</Text>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.categoryRow}> 
                {skillCategories.map((category) => (
                  <TouchableOpacity
                    key={category.key}
                    style={[
                      styles.categoryButton,
                      selectedCategory === category.key && styles.categoryButtonActive,
                    ]}
                    onPress={() => setSelectedCategory(category.key)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        selectedCategory === category.key && styles.categoryButtonTextActive,
                      ]}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.skillsRowModal}>
                {skillCategories
                  .find((category) => category.key === selectedCategory)
                  ?.skills.map((skill) => {
                    const selected = selectedSkills.includes(skill);
                    return (
                      <TouchableOpacity
                        key={skill}
                        style={[styles.skillChip, selected && styles.skillChipSelected]}
                        onPress={() => {
                          setSelectedSkills((prev) =>
                            prev.includes(skill)
                              ? prev.filter((item) => item !== skill)
                              : [...prev, skill]
                          );
                        }}
                      >
                        <Text style={[styles.skillText, selected && styles.skillTextSelected]}>{skill}</Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSkillModalVisible(false)}>
                <Text style={styles.modalCloseText}>Zatvori</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Text style={styles.helpText}>
        {selectedSkills.length > 0
          ? `Odabrane veštine: ${selectedSkills.join(', ')}`
          : 'Odaberi najmanje jednu veštinu iz popup-a.'}
      </Text>

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="O sebi"
        placeholderTextColor="#999"
        value={bio}
        onChangeText={setBio}
        multiline
      />

      <Text style={styles.sectionTitle}>Iskustvo</Text>
      <Text style={styles.sectionSubtitle}>
        Dodaj prethodne pozicije ako želiš. Ovo nije obavezno.
      </Text>

      {experienceItems.map((item, index) => (
        <View key={index} style={styles.experienceCard}>
          <Text style={styles.experienceTitle}>{item.position}</Text>
          <Text style={styles.experienceDuration}>{item.duration}</Text>
          {!!item.description && <Text style={styles.experienceDesc}>{item.description}</Text>}

          <TouchableOpacity onPress={() => removeExperience(index)}>
            <Text style={styles.removeText}>Ukloni</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TextInput
        style={styles.input}
        placeholder="Pozicija na kojoj si radio"
        placeholderTextColor="#999"
        value={expPosition}
        onChangeText={setExpPosition}
      />

      <TextInput
        style={styles.input}
        placeholder="Koliko dugo? npr. 6 meseci, 1 godina"
        placeholderTextColor="#999"
        value={expDuration}
        onChangeText={setExpDuration}
      />

      <TextInput
        style={[styles.input, styles.textAreaSmall]}
        placeholder="Opis iskustva, opciono"
        placeholderTextColor="#999"
        value={expDescription}
        onChangeText={setExpDescription}
        multiline
      />

      <TouchableOpacity style={styles.secondaryButton} onPress={addExperience}>
        <Text style={styles.secondaryButtonText}>+ Dodaj iskustvo</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={saveProfile} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sačuvaj profil</Text>}
      </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  inner: { padding: 24, paddingTop: 60, paddingBottom: 40, alignItems: 'center' },
  pageInner: {
    width: '100%',
    maxWidth: 760,
    alignItems: 'center',
    alignSelf: 'center',
  },
  title: { color: '#fff', fontSize: 30, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: '#888', fontSize: 15, marginBottom: 28 },
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 12, marginBottom: 6 },
  sectionSubtitle: { color: '#888', marginBottom: 16 },
  skillPickerButton: {
    width: '100%',
    maxWidth: 720,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  skillPickerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  skillPickerSubtitle: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    justifyContent: 'center',
  },
  categoryButton: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    margin: 4,
    backgroundColor: '#111',
  },
  categoryButtonActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  categoryButtonText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  skillChip: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    margin: 4,
    backgroundColor: '#111',
  },
  skillChipSelected: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  skillText: {
    color: '#ccc',
    fontSize: 13,
  },
  skillTextSelected: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 760,
    backgroundColor: '#0f0f14',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#222',
    maxHeight: '85%',
  },
  modalHeader: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
    textAlign: 'center',
  },
  modalContent: {
    paddingBottom: 14,
  },
  skillsRowModal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  modalFooter: {
    marginTop: 12,
    alignItems: 'center',
  },
  modalCloseButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 26,
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  helpText: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
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
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  textAreaSmall: { minHeight: 80, textAlignVertical: 'top' },
  experienceCard: {
    backgroundColor: '#151515',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  experienceTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  experienceDuration: { color: '#6C63FF', marginTop: 4, marginBottom: 6 },
  experienceDesc: { color: '#aaa', marginBottom: 10 },
  removeText: { color: '#ff5c5c', fontWeight: 'bold' },
  secondaryButton: {
    borderColor: '#6C63FF',
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 14,
  },
  secondaryButtonText: { color: '#6C63FF', fontWeight: 'bold' },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});