import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants';
import { JobListing } from '../types';

type Props = {
  jobs: JobListing[];
  selectedJob: JobListing | null;
  visible: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (job: JobListing) => void;
};

export default function CompanyJobSelector({ jobs, selectedJob, visible, onOpen, onClose, onSelect }: Props) {
  return (
    <>
      <TouchableOpacity activeOpacity={0.84} onPress={onOpen} style={styles.trigger}>
        <LinearGradient colors={['rgba(124,92,255,0.24)', 'rgba(54,209,220,0.10)']} style={styles.triggerIcon}>
          <Ionicons name="briefcase" size={20} color={COLORS.primarySoft} />
        </LinearGradient>
        <View style={styles.triggerCopy}>
          <Text style={styles.eyebrow}>KANDIDATI ZA OGLAS</Text>
          <Text style={styles.triggerTitle} numberOfLines={1}>{selectedJob?.title || 'Izaberi aktivan oglas'}</Text>
          {!!selectedJob?.location && <Text style={styles.triggerMeta} numberOfLines={1}>{selectedJob.location}</Text>}
        </View>
        <View style={styles.chevron}><Ionicons name="chevron-down" size={19} color={COLORS.textSoft} /></View>
      </TouchableOpacity>

      <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.headerIcon}><Ionicons name="git-branch-outline" size={22} color={COLORS.primarySoft} /></View>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>KONTEKST PRETRAGE</Text>
                <Text style={styles.headerTitle}>Za koji oglas tražiš kandidata?</Text>
                <Text style={styles.headerText}>Match score i svaki swipe pripadace izabranom oglasu.</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}><Ionicons name="close" size={22} color={COLORS.textMuted} /></TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.list}>
              {jobs.map((job) => {
                const selected = job.id === selectedJob?.id;
                return (
                  <TouchableOpacity key={job.id} activeOpacity={0.82} onPress={() => onSelect(job)} style={[styles.jobCard, selected && styles.jobCardSelected]}>
                    <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <Ionicons name="checkmark" size={14} color={COLORS.white} />}</View>
                    <View style={styles.jobCopy}>
                      <Text style={[styles.jobTitle, selected && styles.jobTitleSelected]}>{job.title}</Text>
                      <View style={styles.jobMetaRow}>
                        <Ionicons name="location-outline" size={13} color={COLORS.lightGray} />
                        <Text style={styles.jobMeta}>{job.location || 'Bez lokacije'}</Text>
                        {!!job.job_type && <Text style={styles.jobType}>{job.job_type}</Text>}
                      </View>
                    </View>
                    <Ionicons name="arrow-forward" size={18} color={selected ? COLORS.primarySoft : COLORS.lightGray} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { width: '100%', maxWidth: 720, minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 22, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(124,92,255,0.28)', backgroundColor: COLORS.card, boxShadow: '0px 14px 30px rgba(0,0,0,0.18)' },
  triggerIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  triggerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: COLORS.primarySoft, fontSize: 9, fontWeight: '900', letterSpacing: 1.05 },
  triggerTitle: { color: COLORS.white, fontSize: 15, fontWeight: '900', marginTop: 3 },
  triggerMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },
  chevron: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.glass },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.76)' },
  sheet: { maxHeight: '86%', paddingBottom: 20, backgroundColor: COLORS.dark, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.16)' },
  headerCopy: { flex: 1 },
  headerTitle: { color: COLORS.white, fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 4 },
  headerText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 9 },
  jobCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  jobCardSelected: { borderColor: 'rgba(124,92,255,0.58)', backgroundColor: 'rgba(124,92,255,0.13)' },
  radio: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.lightGray },
  radioSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  jobCopy: { flex: 1, minWidth: 0 },
  jobTitle: { color: COLORS.textSoft, fontSize: 14, fontWeight: '800' },
  jobTitleSelected: { color: COLORS.white },
  jobMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  jobMeta: { color: COLORS.textMuted, fontSize: 11 },
  jobType: { color: COLORS.accent, fontSize: 10, fontWeight: '800', marginLeft: 5 },
});
