import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { supabase } from '../../lib/supabase';
import { ExperienceItem } from '../../types';
import AddressPicker from '../../components/AddressPicker';
import SkillPicker from '../../components/SkillPicker';
import PositionPicker from '../../components/PositionPicker';
import ExperienceDurationPicker from '../../components/experience-duration-picker';
import { COLORS } from '../../constants';
import { INPUT_LIMITS } from '../../constants/inputLimits';

export default function CandidateSetupScreen() {
  const { user, refreshProfile } = useAuth();

  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [expCompany, setExpCompany] = useState('');
  const [expPosition, setExpPosition] = useState('');
  const [expDuration, setExpDuration] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [experienceItems, setExperienceItems] = useState<ExperienceItem[]>([]);
  const [loading, setLoading] = useState(false);

  const completionCount = useMemo(() => {
    let count = 0;
    if (location.trim()) count += 1;
    if (selectedSkills.length > 0) count += 1;
    if (bio.trim()) count += 1;
    if (experienceItems.length > 0) count += 1;
    return count;
  }, [bio, experienceItems.length, location, selectedSkills.length]);

  const addExperience = () => {
    if (!expCompany.trim() || !expPosition.trim() || !expDuration.trim()) {
      Alert.alert('Nedostaju podaci', 'Unesi firmu, poziciju i trajanje iskustva.');
      return;
    }

    setExperienceItems((items) => [
      ...items,
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
    setExperienceItems((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveProfile = async () => {
    if (!user) return;

    if (!location.trim()) {
      Alert.alert('Lokacija je obavezna', 'Unesi prva 3 slova i izaberi adresu gde živiš.');
      return;
    }

    if (selectedSkills.length === 0) {
      Alert.alert('Veštine su obavezne', 'Izaberi bar jednu veštinu iz menija.');
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
        Alert.alert('Profil nije sačuvan', profileError.message);
      setLoading(false);
      return;
    }

    const { error: candidateError } = await supabase
      .from('candidate_profiles')
      .update({
        position: null,
        experience_level: null,
        skills: selectedSkills,
        experience_items: experienceItems,
      })
      .eq('id', user.id);

    if (candidateError) {
        Alert.alert('Profil nije sačuvan', candidateError.message);
      setLoading(false);
      return;
    }

    await refreshProfile();
    setLoading(false);
      Alert.alert('Profil sačuvan', 'Spreman si za pregled oglasa.');
  };

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.inner}
    >
      <View style={styles.pageInner}>
        <LinearGradient colors={['#221B55', '#101827', '#080A12']} style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroIcon}>
            <Ionicons name="person-add-outline" size={28} color={COLORS.primarySoft} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>KANDIDAT WORKSPACE</Text>
            <Text style={styles.title}>Popuni profil</Text>
            <Text style={styles.subtitle}>
              Dodaj lokaciju, veštine i iskustvo da bi JobHop mogao preciznije da izračuna poklapanje sa oglasima.
            </Text>
          </View>
          <View style={styles.progressPill}>
            <Ionicons name="sparkles-outline" size={15} color={COLORS.primarySoft} />
            <Text style={styles.progressText}>{completionCount}/4</Text>
          </View>
        </LinearGradient>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="location-outline" size={21} color={COLORS.primarySoft} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>01 / LOKACIJA</Text>
              <Text style={styles.sectionTitle}>Gde živiš</Text>
              <Text style={styles.sectionSubtitle}>Unesi bar 3 slova i izaberi adresu. Ovo koristimo za udaljenost od posla.</Text>
            </View>
          </View>
          <AddressPicker value={location} onChange={setLocation} placeholder="npr. Pavla Vujisica, Beograd" />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="sparkles-outline" size={21} color={COLORS.primarySoft} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>02 / VESTINE</Text>
              <Text style={styles.sectionTitle}>Šta znaš da radiš?</Text>
              <Text style={styles.sectionSubtitle}>Izaberi veštine iz menija. One su glavni signal za poklapanje sa oglasima.</Text>
            </View>
          </View>
          <SkillPicker
            label="Veštine"
            placeholder="Izaberi veštine koje najbolje opisuju tvoj rad"
            value={selectedSkills}
            onChange={setSelectedSkills}
          />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="document-text-outline" size={21} color={COLORS.primarySoft} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>03 / O TEBI</Text>
              <Text style={styles.sectionTitle}>Kratak opis</Text>
              <Text style={styles.sectionSubtitle}>Neka bude jasno, kratko i konkretno. Ovo firme vide na profilu.</Text>
            </View>
          </View>
          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>O sebi</Text>
            <Text style={styles.charCounter}>{bio.length}/{INPUT_LIMITS.bio}</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Npr. Radim brzo, volim rad sa ljudima i tražim stabilan tim..."
            placeholderTextColor={COLORS.lightGray}
            value={bio}
            onChangeText={setBio}
            maxLength={INPUT_LIMITS.bio}
            multiline
          />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="briefcase-outline" size={21} color={COLORS.primarySoft} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>04 / ISKUSTVO</Text>
              <Text style={styles.sectionTitle}>Šta si radio do sada?</Text>
              <Text style={styles.sectionSubtitle}>Nije obavezno za start, ali pomaze firmama da te bolje razumeju.</Text>
            </View>
          </View>

          {experienceItems.map((item, index) => (
            <View key={`${item.position}-${index}`} style={styles.experienceCard}>
              <View style={styles.experienceMarker} />
              <View style={styles.experienceCopy}>
                {!!item.company && <Text style={styles.experienceCompany}>{item.company}</Text>}
                <Text style={styles.experienceTitle}>{item.position}</Text>
                <Text style={styles.experienceDuration}>{item.duration}</Text>
                {!!item.description && <Text style={styles.experienceDesc}>{item.description}</Text>}
              </View>
              <TouchableOpacity style={styles.removeButton} onPress={() => removeExperience(index)}>
                <Ionicons name="trash-outline" size={18} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>Firma</Text>
            <Text style={styles.charCounter}>{expCompany.length}/{INPUT_LIMITS.experienceCompany}</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Firma u kojoj si radio"
            placeholderTextColor={COLORS.lightGray}
            value={expCompany}
            onChangeText={setExpCompany}
            maxLength={INPUT_LIMITS.experienceCompany}
          />

          <Text style={styles.fieldLabel}>Pozicija</Text>
          <PositionPicker
            placeholder="Pozicija na kojoj si radio"
            value={expPosition}
            onChange={setExpPosition}
            maxLength={INPUT_LIMITS.position}
          />

          <ExperienceDurationPicker value={expDuration} onChange={setExpDuration} />

          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>Opis iskustva</Text>
            <Text style={styles.charCounter}>{expDescription.length}/{INPUT_LIMITS.experienceDescription}</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textAreaSmall]}
            placeholder="Šta si radio i šta je bio rezultat?"
            placeholderTextColor={COLORS.lightGray}
            value={expDescription}
            onChangeText={setExpDescription}
            maxLength={INPUT_LIMITS.experienceDescription}
            multiline
          />

          <TouchableOpacity style={styles.secondaryButton} onPress={addExperience} activeOpacity={0.84}>
            <Ionicons name="add" size={19} color={COLORS.primarySoft} />
            <Text style={styles.secondaryButtonText}>Dodaj iskustvo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.saveDock}>
          <View style={styles.saveCopy}>
            <Text style={styles.saveTitle}>Spreman profil?</Text>
            <Text style={styles.saveSubtitle}>Kasnije uvek možeš da ga izmeniš iz profila.</Text>
          </View>
          <TouchableOpacity style={styles.saveTouch} onPress={saveProfile} disabled={loading} activeOpacity={0.86}>
            <LinearGradient colors={[COLORS.primary, '#9B6DFF']} style={styles.saveButton}>
              {loading ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />}
              <Text style={styles.saveButtonText}>{loading ? 'Čuvanje...' : 'Sačuvaj profil'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.dark },
  inner: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 42 },
  pageInner: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: 16 },
  hero: {
    minHeight: 220,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    padding: 22,
    gap: 14,
    boxShadow: '0px 18px 44px rgba(0,0,0,0.26)',
  },
  heroGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -80, top: -110, backgroundColor: 'rgba(124,92,255,0.24)' },
  heroIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.16)', borderWidth: 1, borderColor: COLORS.border },
  heroCopy: { gap: 6 },
  eyebrow: { color: COLORS.primarySoft, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: COLORS.white, fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { color: COLORS.textSoft, fontSize: 14, lineHeight: 21, maxWidth: 620 },
  progressPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.border },
  progressText: { color: COLORS.white, fontSize: 12, fontWeight: '900' },
  sectionCard: { padding: 20, borderRadius: 24, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, gap: 16, boxShadow: '0px 14px 34px rgba(0,0,0,0.14)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  sectionIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.15)' },
  sectionCopy: { flex: 1 },
  sectionEyebrow: { color: COLORS.primarySoft, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: COLORS.white, fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 3 },
  sectionSubtitle: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  fieldLabel: { color: COLORS.textSoft, fontSize: 12, fontWeight: '900' },
  charCounter: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800' },
  input: { minHeight: 54, borderRadius: 15, backgroundColor: COLORS.input, borderWidth: 1, borderColor: COLORS.border, color: COLORS.white, paddingHorizontal: 14, fontSize: 15 },
  textArea: { minHeight: 104, paddingTop: 14, textAlignVertical: 'top' },
  textAreaSmall: { minHeight: 86, paddingTop: 14, textAlignVertical: 'top' },
  experienceCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 18, backgroundColor: COLORS.cardRaised, borderWidth: 1, borderColor: COLORS.border },
  experienceMarker: { width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: COLORS.primarySoft },
  experienceCopy: { flex: 1, gap: 3 },
  experienceCompany: { color: COLORS.primarySoft, fontSize: 12, fontWeight: '900' },
  experienceTitle: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
  experienceDuration: { color: COLORS.textMuted, fontSize: 12, fontWeight: '800' },
  experienceDesc: { color: COLORS.textSoft, fontSize: 12, lineHeight: 17, marginTop: 3 },
  removeButton: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.dangerBg },
  secondaryButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(124,92,255,0.45)', backgroundColor: 'rgba(124,92,255,0.12)' },
  secondaryButtonText: { color: COLORS.primarySoft, fontWeight: '900' },
  saveDock: { padding: 18, borderRadius: 24, backgroundColor: COLORS.cardRaised, borderWidth: 1, borderColor: COLORS.border, gap: 14 },
  saveCopy: { gap: 3 },
  saveTitle: { color: COLORS.white, fontSize: 18, fontWeight: '900' },
  saveSubtitle: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  saveTouch: { width: '100%' },
  saveButton: { minHeight: 54, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  saveButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
});
