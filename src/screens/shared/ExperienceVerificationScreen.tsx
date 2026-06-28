import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS } from '../../constants';
import { useAuth } from '../../hooks/useAuth';
import { verificationService } from '../../services';
import { ExperienceItem, ExperienceVerification } from '../../types';

const snapshotMatches = (
  verification: ExperienceVerification,
  experience: ExperienceItem,
  experienceIndex: number
) =>
  verification.experience_index === experienceIndex &&
  verification.company_name === (experience.company?.trim() || '') &&
  verification.position === experience.position.trim() &&
  verification.duration === experience.duration.trim() &&
  verification.description === (experience.description?.trim() || '');

const statusContent: Record<
  ExperienceVerification['status'],
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: { label: 'Ceka rucnu proveru', color: COLORS.gold, icon: 'time-outline' },
  verified: { label: 'Verifikovano dokumentom', color: COLORS.mint, icon: 'checkmark-circle' },
  rejected: { label: 'Odbijeno', color: COLORS.secondary, icon: 'close-circle' },
  changes_requested: { label: 'Potreban je novi dokument', color: COLORS.gold, icon: 'document-attach-outline' },
};

const acceptedDocuments = [
  {
    title: 'Ugovor o radu ili aneks ugovora',
    detail: 'Treba da se vide ime, firma, pozicija i datum ili period rada.',
  },
  {
    title: 'Potvrda poslodavca o zaposlenju',
    detail: 'Potpisana potvrda koja navodi poziciju i period angažovanja.',
  },
  {
    title: 'Preporuka ili referenca poslodavca',
    detail: 'Po mogucnosti na memorandumu firme ili sa kontaktom odgovorne osobe.',
  },
  {
    title: 'Resenje o zaposlenju ili rasporedjivanju',
    detail: 'Dokument na kojem su povezani kandidat, firma i radno mesto.',
  },
  {
    title: 'Evidencija staza ili potvrda osiguranja',
    detail: 'Prihvata se kada jasno pokazuje poslodavca i odgovarajući period.',
  },
  {
    title: 'Obracunski listic',
    detail: 'Naziv firme i pozicija moraju biti vidljivi; iznos plate slobodno prekrij.',
  },
  {
    title: 'Ugovor o praksi, volontiranju ili honorarnom radu',
    detail: 'Vazi i za praksu, freelance i projektni angazman ako opisuje ulogu.',
  },
  {
    title: 'Sluzbena legitimacija uz dodatni dokaz',
    detail: 'Kartica ili bedz sami nisu dovoljni, ali mogu dopuniti drugi dokument.',
  },
];

const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

const isAllowedVerificationDocument = (asset: DocumentPicker.DocumentPickerAsset) => {
  const extension = asset.name.split('.').pop()?.toLowerCase() || '';
  const mimeTypeAllowed = !asset.mimeType || ALLOWED_DOCUMENT_MIME_TYPES.includes(asset.mimeType);
  return ALLOWED_DOCUMENT_EXTENSIONS.includes(extension) && mimeTypeAllowed;
};

export default function ExperienceVerificationScreen({ route, navigation }: any) {
  const { experience, experienceIndex } = route.params as {
    experience: ExperienceItem;
    experienceIndex: number;
  };
  const { user } = useAuth();
  const [verification, setVerification] = useState<ExperienceVerification | null>(null);
  const [document, setDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<'reading' | 'uploading' | 'saving' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadVerification = useCallback(async () => {
    if (!user) return;
    try {
      const rows = await verificationService.fetchCandidateVerifications(user.id);
      setVerification(rows.find((row) => snapshotMatches(row, experience, experienceIndex)) || null);
    } catch (error: any) {
      Alert.alert('Verifikacija nije dostupna', error?.message || 'Proveri da li je Supabase migracija pokrenuta.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, experienceIndex, experience.company, experience.position, experience.duration, experience.description]);

  useFocusEffect(
    useCallback(() => {
      loadVerification();
    }, [loadVerification])
  );

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      if (!isAllowedVerificationDocument(asset)) {
        setDocument(null);
        setSubmitError('Dozvoljeni su samo PDF, JPG, JPEG, PNG i WEBP fajlovi.');
        Alert.alert('Fajl nije dozvoljen', 'Za verifikaciju možeš poslati samo PDF, JPG, JPEG, PNG ili WEBP.');
        return;
      }
      setDocument(asset);
      setSubmitError(null);
    }
  };

  const submit = async () => {
    setSubmitError(null);
    setSubmitStep('reading');

    if (!user) {
      setSubmitStep(null);
      setSubmitError('Sesija je istekla. Odjavi se i prijavi ponovo.');
      return;
    }

    if (!document) {
      setSubmitStep(null);
      setSubmitError('Prvo izaberi dokument ili fotografiju.');
      return;
    }

    if (!experience.company?.trim()) {
      setSubmitStep(null);
      setSubmitError('Dodaj naziv firme u iskustvo pre slanja na proveru.');
      return;
    }

    setSubmitting(true);
    console.info('[verification] submit started', {
      name: document.name,
      size: document.size,
      mimeType: document.mimeType,
    });
    try {
      const created = await verificationService.submitVerification(
        user.id,
        experienceIndex,
        experience,
        document,
        setSubmitStep
      );
      setVerification(created);
      setDocument(null);
      console.info('[verification] submit completed', created.id);
      Alert.alert('Poslato', 'Dokument je dodat u red za rucnu proveru.');
    } catch (error: any) {
      const message = error?.message || 'Pokušaj ponovo.';
      console.error('[verification] submit failed', error);
      setSubmitError(message);
      Alert.alert('Slanje nije uspelo', message);
    } finally {
      setSubmitting(false);
      setSubmitStep(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primarySoft} />
      </View>
    );
  }

  const currentStatus = verification ? statusContent[verification.status] : null;
  const locked = verification?.status === 'pending' || verification?.status === 'verified';

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primarySoft} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Rucna provera</Text>
          <Text style={styles.title}>Verifikuj iskustvo</Text>
        </View>
      </View>

      <View style={styles.experiencePanel}>
        <Text style={styles.company}>{experience.company || 'Firma nije navedena'}</Text>
        <Text style={styles.position}>{experience.position}</Text>
        <Text style={styles.duration}>{experience.duration}</Text>
        {!!experience.description && <Text style={styles.description}>{experience.description}</Text>}
      </View>

      <View style={styles.documentsPanel}>
        <View style={styles.documentsHeader}>
          <View style={styles.documentsIcon}>
            <Ionicons name="documents-outline" size={21} color={COLORS.primarySoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.documentsTitle}>Dokumenti koje možeš poslati</Text>
            <Text style={styles.documentsSubtitle}>Dovoljan je jedan jasan i verodostojan dokaz.</Text>
          </View>
        </View>

        {acceptedDocuments.map((item) => (
          <View key={item.title} style={styles.documentOption}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.mint} />
            <View style={{ flex: 1 }}>
              <Text style={styles.documentOptionTitle}>{item.title}</Text>
              <Text style={styles.documentOptionDetail}>{item.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      {currentStatus && verification && (
        <View style={[styles.statusPanel, { borderColor: `${currentStatus.color}55` }]}>
          <Ionicons name={currentStatus.icon} size={24} color={currentStatus.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: currentStatus.color }]}>{currentStatus.label}</Text>
            {!!verification.review_note && <Text style={styles.reviewNote}>{verification.review_note}</Text>}
          </View>
        </View>
      )}

      {!locked && (
        <>
          <View style={styles.notice}>
            <Ionicons name="shield-checkmark-outline" size={23} color={COLORS.accent} />
            <Text style={styles.noticeText}>
              Pre slanja prekrij JMBG, adresu, broj racuna, platu i druge podatke koji nisu potrebni za proveru iskustva.
            </Text>
          </View>

          <TouchableOpacity style={styles.documentPicker} onPress={pickDocument}>
            <View style={styles.documentIcon}>
              <Ionicons name={document ? 'document-text' : 'cloud-upload-outline'} size={25} color={COLORS.primarySoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.documentTitle}>{document?.name || 'Dodaj dokument ili fotografiju'}</Text>
              <Text style={styles.documentSubtitle}>PDF, JPG, PNG ili WEBP, najviše 10 MB</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="submit-verification"
            style={[styles.submitButton, (!document || submitting) && styles.buttonDisabled]}
            disabled={submitting}
            onPress={() => void submit()}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.submitText}>Pošalji na proveru</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
              </>
            )}
          </TouchableOpacity>
          {!!document && !submitting && !submitError && (
            <Text style={styles.readyText}>Dokument je spreman za slanje.</Text>
          )}
          {submitting && (
            <Text style={styles.progressText}>
              {submitStep === 'reading' && 'Citam dokument...'}
              {submitStep === 'uploading' && 'Saljem dokument...'}
              {submitStep === 'saving' && 'Čuvam zahtev...'}
            </Text>
          )}
          {!!submitError && (
            <View style={styles.errorPanel}>
              <Ionicons name="alert-circle-outline" size={19} color={COLORS.secondary} />
              <Text style={styles.errorText}>{submitError}</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.dark },
  content: { padding: 20, paddingTop: 54, paddingBottom: 48, gap: 16 },
  center: { flex: 1, backgroundColor: COLORS.dark, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { color: COLORS.primarySoft, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: COLORS.white, fontSize: 27, fontWeight: '900', marginTop: 3 },
  experiencePanel: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 18,
  },
  company: { color: COLORS.accent, fontSize: 13, fontWeight: '900', marginBottom: 6 },
  position: { color: COLORS.white, fontSize: 21, fontWeight: '900' },
  duration: { color: COLORS.primarySoft, fontSize: 13, fontWeight: '800', marginTop: 6 },
  description: { color: COLORS.textMuted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  documentsPanel: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 17 },
  documentsHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 },
  documentsIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(124,92,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  documentsTitle: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
  documentsSubtitle: { color: COLORS.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  documentOption: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  documentOptionTitle: { color: COLORS.textSoft, fontSize: 13, fontWeight: '900' },
  documentOptionDetail: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  statusPanel: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  statusLabel: { fontSize: 14, fontWeight: '900' },
  reviewNote: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(54,209,220,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(54,209,220,0.22)',
    borderRadius: 18,
    padding: 16,
  },
  noticeText: { color: COLORS.textSoft, fontSize: 13, lineHeight: 20, flex: 1 },
  documentPicker: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 14,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(124,92,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentTitle: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
  documentSubtitle: { color: COLORS.textMuted, fontSize: 11, marginTop: 5 },
  submitButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: { opacity: 0.45 },
  submitText: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
  progressText: { color: COLORS.primarySoft, textAlign: 'center', fontSize: 13, fontWeight: '800' },
  readyText: { color: COLORS.mint, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  errorPanel: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.dangerBg, borderWidth: 1, borderColor: 'rgba(255, 95, 126, 0.3)', borderRadius: 15, padding: 12 },
  errorText: { color: COLORS.secondary, flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '700' },
});
