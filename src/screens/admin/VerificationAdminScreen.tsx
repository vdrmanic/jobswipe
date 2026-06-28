import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants';
import { INPUT_LIMITS } from '../../constants/inputLimits';
import { useAuth } from '../../hooks/useAuth';
import { verificationService } from '../../services';
import { ExperienceVerification, ExperienceVerificationStatus } from '../../types';

type ReviewAction = 'verified' | 'rejected' | 'changes_requested';

export default function VerificationAdminScreen({ navigation }: any) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ExperienceVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [selected, setSelected] = useState<ExperienceVerification | null>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction>('changes_requested');
  const [reviewNote, setReviewNote] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const isAdmin = await verificationService.isAdmin(user.id);
      setAuthorized(isAdmin);
      if (!isAdmin) return;
      setRequests(await verificationService.fetchReviewQueue(filter));
    } catch (error: any) {
      Alert.alert('Greška', error?.message || 'Nije moguće učitati zahteve.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openDocument = async (request: ExperienceVerification) => {
    try {
      const url = await verificationService.createDocumentUrl(request.document_path);
      await Linking.openURL(url);
    } catch (error: any) {
      Alert.alert('Dokument nije dostupan', error?.message || 'Pokušaj ponovo.');
    }
  };

  const openReviewModal = (request: ExperienceVerification, action: ReviewAction) => {
    setSelected(request);
    setReviewAction(action);
    setReviewNote('');
  };

  const submitReview = async () => {
    if (!selected) return;

    if (reviewAction !== 'verified' && !reviewNote.trim()) {
      Alert.alert('Dodaj razlog', 'Kandidat mora da zna zašto zahtev nije odobren.');
      return;
    }

    setReviewing(selected.id);
    try {
      await verificationService.review(
        selected.id,
        reviewAction,
        reviewAction === 'verified' ? undefined : reviewNote
      );
      setSelected(null);
      setReviewNote('');
      await load();
    } catch (error: any) {
      Alert.alert('Greška', error?.message || 'Provera nije sačuvana.');
    } finally {
      setReviewing(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primarySoft} />
      </View>
    );
  }

  if (!authorized) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={36} color={COLORS.secondary} />
        <Text style={styles.deniedTitle}>Admin pristup je potreban</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Nazad</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primarySoft} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>JobHop admin</Text>
          <Text style={styles.title}>Provera iskustava</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['pending', 'all'] as const).map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.filterButton, filter === value && styles.filterButtonActive]}
            onPress={() => setFilter(value)}
          >
            <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
                  {value === 'pending' ? 'Na čekanju' : 'Svi zahtevi'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={38} color={COLORS.mint} />
            <Text style={styles.emptyTitle}>Nema zahteva u ovom redu</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.requestCard}>
            <View style={styles.candidateRow}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={21} color={COLORS.primarySoft} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.candidateName}>{item.profiles?.full_name || 'Kandidat'}</Text>
                <Text style={styles.requestDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
              <StatusBadge status={item.status} />
            </View>

            <Text style={styles.company}>{item.company_name || 'Firma nije navedena'}</Text>
            <Text style={styles.position}>{item.position}</Text>
            <Text style={styles.duration}>{item.duration}</Text>
            {!!item.description && <Text style={styles.description}>{item.description}</Text>}

            <TouchableOpacity style={styles.documentButton} onPress={() => openDocument(item)}>
              <Ionicons name="document-text-outline" size={19} color={COLORS.accent} />
              <Text style={styles.documentText} numberOfLines={1}>{item.document_name}</Text>
              <Ionicons name="open-outline" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            {item.status === 'pending' && (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.rejectButton} onPress={() => openReviewModal(item, 'rejected')}>
                  <Text style={styles.rejectText}>Odbij</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.changesButton} onPress={() => openReviewModal(item, 'changes_requested')}>
                  <Text style={styles.changesText}>Novi dokument</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.approveButton} onPress={() => openReviewModal(item, 'verified')} disabled={reviewing === item.id}>
                  {reviewing === item.id ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.approveText}>Odobri</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {!!item.review_note && <Text style={styles.reviewNote}>Napomena: {item.review_note}</Text>}
          </View>
        )}
      />

      <Modal transparent animationType="fade" visible={Boolean(selected)} onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {reviewAction === 'verified'
                ? 'Odobri iskustvo?'
                : reviewAction === 'rejected'
                  ? 'Odbij zahtev'
                  : 'Traži novi dokument'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {reviewAction === 'verified'
                  ? 'Kandidat i firme će videti oznaku da je ovo iskustvo verifikovano.'
                : 'Napisi jasan razlog koji ce kandidat videti.'}
            </Text>
            {reviewAction !== 'verified' && (
              <TextInput
                value={reviewNote}
                onChangeText={setReviewNote}
                placeholder="Razlog odluke"
                placeholderTextColor={COLORS.lightGray}
                style={styles.noteInput}
                maxLength={INPUT_LIMITS.adminNote}
                multiline
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setSelected(null)}>
                <Text style={styles.modalCancelText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, reviewAction === 'verified' && styles.modalApprove]}
                onPress={submitReview}
                disabled={Boolean(reviewing)}
              >
                {reviewing ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {reviewAction === 'verified' ? 'Odobri' : 'Potvrdi'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatusBadge({ status }: { status: ExperienceVerificationStatus }) {
  const config: Record<ExperienceVerificationStatus, { label: string; color: string }> = {
    pending: { label: 'Ceka', color: COLORS.gold },
    verified: { label: 'Verifikovano', color: COLORS.mint },
    rejected: { label: 'Odbijeno', color: COLORS.secondary },
    changes_requested: { label: 'Novi dokument', color: COLORS.gold },
  };
  const item = config[status];
  return (
    <View style={[styles.statusBadge, { borderColor: `${item.color}55` }]}>
      <Text style={[styles.statusBadgeText, { color: item.color }]}>{item.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.dark },
  center: { flex: 1, backgroundColor: COLORS.dark, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { paddingTop: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: COLORS.glass, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: COLORS.primarySoft, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: COLORS.white, fontSize: 27, fontWeight: '900', marginTop: 3 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingTop: 18 },
  filterButton: { flex: 1, minHeight: 42, borderRadius: 15, backgroundColor: COLORS.glass, alignItems: 'center', justifyContent: 'center' },
  filterButtonActive: { backgroundColor: COLORS.primary },
  filterText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '900' },
  filterTextActive: { color: COLORS.white },
  list: { padding: 18, paddingBottom: 36 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 90 },
  emptyTitle: { color: COLORS.textMuted, fontSize: 15, fontWeight: '800' },
  requestCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 17, marginBottom: 14 },
  candidateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: COLORS.glass, alignItems: 'center', justifyContent: 'center' },
  candidateName: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
  requestDate: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },
  statusBadge: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 9 },
  statusBadgeText: { fontSize: 10, fontWeight: '900' },
  company: { color: COLORS.accent, fontSize: 12, fontWeight: '900' },
  position: { color: COLORS.white, fontSize: 20, fontWeight: '900', marginTop: 5 },
  duration: { color: COLORS.primarySoft, fontSize: 12, fontWeight: '800', marginTop: 5 },
  description: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginTop: 9 },
  documentButton: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 48, borderRadius: 15, backgroundColor: COLORS.glass, paddingHorizontal: 12, marginTop: 14 },
  documentText: { color: COLORS.textSoft, fontSize: 12, fontWeight: '800', flex: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  rejectButton: { flex: 0.75, minHeight: 44, borderRadius: 14, backgroundColor: COLORS.dangerBg, alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: COLORS.secondary, fontWeight: '900', fontSize: 12 },
  changesButton: { flex: 1.2, minHeight: 44, borderRadius: 14, backgroundColor: 'rgba(248,196,92,0.12)', alignItems: 'center', justifyContent: 'center' },
  changesText: { color: COLORS.gold, fontWeight: '900', fontSize: 12 },
  approveButton: { flex: 0.9, minHeight: 44, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  approveText: { color: COLORS.white, fontWeight: '900', fontSize: 12 },
  reviewNote: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  deniedTitle: { color: COLORS.white, fontSize: 20, fontWeight: '900', marginTop: 14 },
  backButton: { backgroundColor: COLORS.primary, borderRadius: 15, paddingVertical: 13, paddingHorizontal: 24, marginTop: 18 },
  backButtonText: { color: COLORS.white, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: COLORS.card, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, padding: 18 },
  modalTitle: { color: COLORS.white, fontSize: 21, fontWeight: '900' },
  modalSubtitle: { color: COLORS.textMuted, fontSize: 13, marginTop: 6 },
  noteInput: { minHeight: 110, borderRadius: 16, backgroundColor: COLORS.input, color: COLORS.white, padding: 14, marginTop: 16, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalCancel: { flex: 1, minHeight: 48, borderRadius: 15, backgroundColor: COLORS.glass, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: COLORS.textSoft, fontWeight: '900' },
  modalSubmit: { flex: 1, minHeight: 48, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  modalApprove: { backgroundColor: COLORS.mint },
  modalSubmitText: { color: COLORS.white, fontWeight: '900' },
});
