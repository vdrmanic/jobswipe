import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { safetyService } from '../services';

const reasons = [
  ['spam', 'Spam ili prevara'],
  ['harassment', 'Uznemiravanje'],
  ['explicit', 'Eksplicitan sadrzaj'],
  ['fake_profile', 'Lazan profil'],
  ['discrimination', 'Diskriminacija'],
  ['other', 'Drugo'],
] as const;

type Props = {
  visible: boolean;
  currentUserId: string;
  reportedUserId: string;
  matchId?: string | null;
  onClose: () => void;
  onBlocked?: () => void;
};

export default function ReportUserModal({ visible, currentUserId, reportedUserId, matchId, onClose, onBlocked }: Props) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await safetyService.report({ reporterId: currentUserId, reportedUserId, matchId, reason, details });
      Alert.alert('Prijava je poslata', 'Administrator ce pregledati prijavu.');
      setReason('');
      setDetails('');
      onClose();
    } catch (error: any) {
      Alert.alert('Prijava nije poslata', error?.message || 'Pokusaj ponovo.');
    } finally {
      setSubmitting(false);
    }
  };

  const block = async () => {
    setSubmitting(true);
    try {
      await safetyService.block(currentUserId, reportedUserId);
      onBlocked?.();
      onClose();
    } catch (error: any) {
      Alert.alert('Blokiranje nije uspelo', error?.message || 'Pokusaj ponovo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="shield-outline" size={24} color={COLORS.secondary} />
            <Text style={styles.title}>Bezbednost</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={23} color={COLORS.textMuted} /></TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Izaberi razlog prijave ili odmah blokiraj korisnika.</Text>
          <View style={styles.reasons}>
            {reasons.map(([value, label]) => (
              <TouchableOpacity key={value} style={[styles.reason, reason === value && styles.reasonSelected]} onPress={() => setReason(value)}>
                <Text style={[styles.reasonText, reason === value && styles.reasonTextSelected]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={details}
            onChangeText={setDetails}
            placeholder="Dodatni detalji, opciono"
            placeholderTextColor={COLORS.lightGray}
            multiline
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.blockButton} onPress={block} disabled={submitting}>
              <Ionicons name="ban" size={18} color={COLORS.secondary} />
              <Text style={styles.blockText}>Blokiraj</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.reportButton, !reason && styles.disabled]} onPress={submit} disabled={!reason || submitting}>
              {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.reportText}>Posalji prijavu</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 480, borderRadius: 22, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: COLORS.white, fontSize: 21, fontWeight: '900', flex: 1 },
  subtitle: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  reason: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.glass },
  reasonSelected: { borderColor: COLORS.secondary, backgroundColor: COLORS.dangerBg },
  reasonText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '800' },
  reasonTextSelected: { color: COLORS.secondary },
  input: { minHeight: 90, borderRadius: 15, backgroundColor: COLORS.input, color: COLORS.white, padding: 13, marginTop: 14, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  blockButton: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, backgroundColor: COLORS.dangerBg },
  blockText: { color: COLORS.secondary, fontWeight: '900' },
  reportButton: { flex: 1.2, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  reportText: { color: COLORS.white, fontWeight: '900' },
  disabled: { opacity: 0.4 },
});

