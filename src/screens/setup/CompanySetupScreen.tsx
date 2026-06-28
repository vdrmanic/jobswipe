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
import AddressPicker from '../../components/AddressPicker';
import { COLORS } from '../../constants';
import { INPUT_LIMITS } from '../../constants/inputLimits';

export default function CompanySetupScreen() {
  const { user, refreshProfile } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  const completionCount = useMemo(() => {
    let count = 0;
    if (companyName.trim()) count += 1;
    if (location.trim()) count += 1;
    if (industry.trim() || companySize.trim()) count += 1;
    if (bio.trim()) count += 1;
    return count;
  }, [bio, companyName, companySize, industry, location]);

  const saveProfile = async () => {
    if (!user) return;

    if (!companyName.trim() || !location.trim()) {
      Alert.alert('Nedostaju podaci', 'Unesi naziv firme i lokaciju.');
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
        Alert.alert('Profil firme nije sačuvan', profileError.message);
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
        Alert.alert('Profil firme nije sačuvan', companyError.message);
      setLoading(false);
      return;
    }

    await refreshProfile();
    setLoading(false);
      Alert.alert('Profil firme sačuvan', 'Spremni ste za kreiranje prvog oglasa.');
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
            <Ionicons name="business-outline" size={30} color={COLORS.primarySoft} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>COMPANY WORKSPACE</Text>
            <Text style={styles.title}>Profil firme</Text>
            <Text style={styles.subtitle}>
              Kandidati prvo vide firmu, pa oglas. Uredi osnovne podatke da profil izgleda ozbiljno i jasno.
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
              <Ionicons name="business-outline" size={21} color={COLORS.primarySoft} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>01 / OSNOVNO</Text>
              <Text style={styles.sectionTitle}>Ko ste vi?</Text>
              <Text style={styles.sectionSubtitle}>Naziv firme je obavezan i prikazuje se kandidatima na kartici oglasa.</Text>
            </View>
          </View>

          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>Naziv firme</Text>
            <Text style={styles.charCounter}>{companyName.length}/{INPUT_LIMITS.companyName}</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="npr. OktagonBet"
            placeholderTextColor={COLORS.lightGray}
            value={companyName}
            onChangeText={setCompanyName}
            maxLength={INPUT_LIMITS.companyName}
          />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="location-outline" size={21} color={COLORS.primarySoft} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>02 / LOKACIJA</Text>
              <Text style={styles.sectionTitle}>Gde radite?</Text>
              <Text style={styles.sectionSubtitle}>Unesi bar 3 slova i izaberi adresu, da kandidat vidi udaljenost od posla.</Text>
            </View>
          </View>
          <AddressPicker value={location} onChange={setLocation} placeholder="npr. Bulevar Mihajla Pupina, Beograd" />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="layers-outline" size={21} color={COLORS.primarySoft} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>03 / DETALJI</Text>
              <Text style={styles.sectionTitle}>Industrija i tim</Text>
              <Text style={styles.sectionSubtitle}>Ovi detalji pomazu kandidatima da brze shvate kontekst firme.</Text>
            </View>
          </View>

          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>Industrija</Text>
            <Text style={styles.charCounter}>{industry.length}/{INPUT_LIMITS.industry}</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="IT, ugostiteljstvo, prodaja..."
            placeholderTextColor={COLORS.lightGray}
            value={industry}
            onChangeText={setIndustry}
            maxLength={INPUT_LIMITS.industry}
          />

          <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Veličina firme</Text>
            <Text style={styles.charCounter}>{companySize.length}/{INPUT_LIMITS.companySize}</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="npr. 1-10, 11-50, 50+"
            placeholderTextColor={COLORS.lightGray}
            value={companySize}
            onChangeText={setCompanySize}
            maxLength={INPUT_LIMITS.companySize}
          />

          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>Website</Text>
            <Text style={styles.charCounter}>{website.length}/{INPUT_LIMITS.website}</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="https://firma.rs"
            placeholderTextColor={COLORS.lightGray}
            value={website}
            onChangeText={setWebsite}
            maxLength={INPUT_LIMITS.website}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="document-text-outline" size={21} color={COLORS.primarySoft} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>04 / OPIS</Text>
              <Text style={styles.sectionTitle}>Zašto bi kandidat izabrao vas?</Text>
              <Text style={styles.sectionSubtitle}>Kratko opiši tim, kulturu i šta kandidat može da očekuje.</Text>
            </View>
          </View>

          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>Opis firme</Text>
            <Text style={styles.charCounter}>{bio.length}/{INPUT_LIMITS.bio}</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Npr. Mali tim, brza komunikacija, jasni ciljevi i prostor za napredovanje..."
            placeholderTextColor={COLORS.lightGray}
            value={bio}
            onChangeText={setBio}
            maxLength={INPUT_LIMITS.bio}
            multiline
          />
        </View>

        <View style={styles.saveDock}>
          <View style={styles.saveCopy}>
            <Text style={styles.saveTitle}>Spremno za prvi oglas?</Text>
            <Text style={styles.saveSubtitle}>Profil firme možeš kasnije da izmenis iz taba Profil.</Text>
          </View>
          <TouchableOpacity style={styles.saveTouch} onPress={saveProfile} disabled={loading} activeOpacity={0.86}>
            <LinearGradient colors={[COLORS.primary, '#9B6DFF']} style={styles.saveButton}>
              {loading ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />}
              <Text style={styles.saveButtonText}>{loading ? 'Čuvanje...' : 'Sačuvaj profil firme'}</Text>
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
  textArea: { minHeight: 112, paddingTop: 14, textAlignVertical: 'top' },
  saveDock: { padding: 18, borderRadius: 24, backgroundColor: COLORS.cardRaised, borderWidth: 1, borderColor: COLORS.border, gap: 14 },
  saveCopy: { gap: 3 },
  saveTitle: { color: COLORS.white, fontSize: 18, fontWeight: '900' },
  saveSubtitle: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  saveTouch: { width: '100%' },
  saveButton: { minHeight: 54, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  saveButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
});
