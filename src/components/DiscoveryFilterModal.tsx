import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PositionPicker from './PositionPicker';
import LocationPicker from './LocationPicker';
import SkillPicker from './SkillPicker';
import { COLORS } from '../constants';
import { INPUT_LIMITS } from '../constants/inputLimits';
import { DiscoveryFilters, DiscoveryMode } from '../types';
import { defaultDiscoveryFilters } from '../utils/matching';

type Props = {
  visible: boolean;
  mode: DiscoveryMode;
  value: DiscoveryFilters;
  onApply: (filters: DiscoveryFilters) => void;
  onClose: () => void;
  tutorialActive?: boolean;
  onTutorialNext?: () => void;
};

const jobTypes = ['Puno radno vreme', 'Pola radnog vremena', 'Praksa', 'Ugovor', 'Remote'];
const experienceLevels = ['junior', 'mid', 'senior'];

const toggle = (items: string[], value: string) =>
  items.includes(value) ? items.filter((item) => item !== value) : [...items, value];

export default function DiscoveryFilterModal({ visible, mode, value, onApply, onClose, tutorialActive = false, onTutorialNext }: Props) {
  const [draft, setDraft] = useState(value);
  const [selectedSkills, setSelectedSkills] = useState(value.skills);

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setSelectedSkills(value.skills);
  }, [visible, value]);

  const apply = () => {
    onApply({
      ...draft,
      skills: selectedSkills,
    });
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="options" size={22} color={COLORS.primarySoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>PRETRAGA</Text>
              <Text style={styles.title}>Podesi filtere</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {tutorialActive && (
              <View style={styles.tutorialCard}>
                <View style={styles.tutorialBadge}>
                  <Ionicons name="sparkles" size={16} color={COLORS.primarySoft} />
                  <Text style={styles.tutorialBadgeText}>KORAK 3</Text>
                </View>
                <Text style={styles.tutorialTitle}>Pronađi baš ono što ti odgovara</Text>
                <Text style={styles.tutorialText}>
                  {mode === 'candidate'
                    ? 'Ovde sužavaš oglase prema poziciji, lokaciji, veštinama i tipu posla. Minimalno poklapanje uklanja oglase koji se slabije uklapaju u tvoj profil.'
                    : 'Ovde sužavaš kandidate prema poziciji, lokaciji, veštinama i iskustvu. Možeš prikazati samo provereno iskustvo i odrediti minimalni procenat poklapanja.'}
                </Text>
                <Text style={styles.tutorialHint}>Filteri se pamte za sledeće otvaranje, a dugme „Resetuj“ vraća prikaz svih rezultata.</Text>
                <TouchableOpacity style={styles.tutorialNextButton} onPress={onTutorialNext}>
                  <Text style={styles.tutorialNextText}>Razumem, nastavi</Text>
                  <Ionicons name="arrow-forward" size={17} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            )}

            <FieldLabel text="Pozicija" />
            <PositionPicker value={draft.position} onChange={(position) => setDraft((prev) => ({ ...prev, position }))} maxLength={INPUT_LIMITS.position} />

            <FieldLabel text="Lokacija" />
            <LocationPicker
              value={draft.location}
              onChange={(location) => setDraft((prev) => ({ ...prev, location }))}
              placeholder="Unesi prva 3 slova grada"
              maxLength={INPUT_LIMITS.filterText}
            />

            <SkillPicker
        label={mode === 'candidate' ? 'Veštine koje oglas mora da traži' : 'Obavezne veštine kandidata'}
              placeholder="Izaberi veštine iz menija"
              value={selectedSkills}
              onChange={setSelectedSkills}
            />

            {mode === 'candidate' ? (
              <>
                <FieldLabel text="Tip posla" />
                <View style={styles.chips}>
                  {jobTypes.map((item) => (
                    <Chip
                      key={item}
                      label={item}
                      selected={draft.jobTypes.includes(item)}
                      onPress={() => setDraft((prev) => ({ ...prev, jobTypes: toggle(prev.jobTypes, item) }))}
                    />
                  ))}
                </View>
              </>
            ) : (
              <>
                <FieldLabel text="Nivo iskustva" />
                <View style={styles.chips}>
                  {experienceLevels.map((item) => (
                    <Chip
                      key={item}
                      label={item.toUpperCase()}
                      selected={draft.experienceLevels.includes(item)}
                      onPress={() => setDraft((prev) => ({ ...prev, experienceLevels: toggle(prev.experienceLevels, item) }))}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setDraft((prev) => ({ ...prev, verifiedOnly: !prev.verifiedOnly }))}
                >
                  <Ionicons name={draft.verifiedOnly ? 'checkbox' : 'square-outline'} size={23} color={draft.verifiedOnly ? COLORS.mint : COLORS.textMuted} />
                  <Text style={styles.toggleText}>Samo kandidati sa verifikovanim iskustvom</Text>
                </TouchableOpacity>
              </>
            )}

            <FieldLabel text="Minimalno poklapanje" />
            <View style={styles.scoreRow}>
              {[0, 50, 70, 85].map((score) => (
                <Chip
                  key={score}
                  label={score === 0 ? 'Sve' : `${score}%+`}
                  selected={draft.minimumScore === score}
                  onPress={() => setDraft((prev) => ({ ...prev, minimumScore: score }))}
                />
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                setDraft(defaultDiscoveryFilters);
                setSelectedSkills([]);
              }}
            >
              <Text style={styles.resetText}>Resetuj</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={apply}>
              <Text style={styles.applyText}>Primeni filtere</Text>
              <Ionicons name="checkmark" size={19} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', backgroundColor: COLORS.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.glass },
  eyebrow: { color: COLORS.primarySoft, fontSize: 10, fontWeight: '900' },
  title: { color: COLORS.white, fontSize: 22, fontWeight: '900', marginTop: 2 },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 28 },
  tutorialCard: { padding: 16, marginBottom: 18, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(124,92,255,0.55)', backgroundColor: 'rgba(124,92,255,0.13)' },
  tutorialBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(124,92,255,0.18)' },
  tutorialBadgeText: { color: COLORS.primarySoft, fontSize: 10, fontWeight: '900' },
  tutorialTitle: { color: COLORS.white, fontSize: 18, fontWeight: '900', marginTop: 12 },
  tutorialText: { color: COLORS.textSoft, fontSize: 13, lineHeight: 20, marginTop: 7 },
  tutorialHint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  tutorialNextButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, borderRadius: 14, backgroundColor: COLORS.primary },
  tutorialNextText: { color: COLORS.white, fontSize: 13, fontWeight: '900' },
  label: { color: COLORS.textSoft, fontSize: 12, fontWeight: '900', marginBottom: 8, marginTop: 5 },
  input: { minHeight: 52, borderRadius: 15, backgroundColor: COLORS.input, borderWidth: 1, borderColor: COLORS.border, color: COLORS.white, paddingHorizontal: 14, marginBottom: 14 },
  counter: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', textAlign: 'right', marginTop: -9, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 13, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.glass },
  chipSelected: { borderColor: COLORS.primary, backgroundColor: 'rgba(124,92,255,0.22)' },
  chipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '800' },
  chipTextSelected: { color: COLORS.white },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, marginBottom: 10 },
  toggleText: { color: COLORS.textSoft, fontSize: 13, fontWeight: '800', flex: 1 },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.card },
  resetButton: { minHeight: 50, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: COLORS.glass },
  resetText: { color: COLORS.textSoft, fontWeight: '900' },
  applyButton: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, backgroundColor: COLORS.primary },
  applyText: { color: COLORS.white, fontWeight: '900' },
});

