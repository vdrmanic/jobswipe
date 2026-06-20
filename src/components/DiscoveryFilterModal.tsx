import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PositionPicker from './PositionPicker';
import { COLORS } from '../constants';
import { DiscoveryFilters, DiscoveryMode } from '../types';
import { defaultDiscoveryFilters } from '../utils/matching';

type Props = {
  visible: boolean;
  mode: DiscoveryMode;
  value: DiscoveryFilters;
  onApply: (filters: DiscoveryFilters) => void;
  onClose: () => void;
};

const jobTypes = ['Puno radno vreme', 'Pola radnog vremena', 'Praksa', 'Ugovor', 'Remote'];
const experienceLevels = ['junior', 'mid', 'senior'];

const toggle = (items: string[], value: string) =>
  items.includes(value) ? items.filter((item) => item !== value) : [...items, value];

export default function DiscoveryFilterModal({ visible, mode, value, onApply, onClose }: Props) {
  const [draft, setDraft] = useState(value);
  const [skillsText, setSkillsText] = useState(value.skills.join(', '));

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setSkillsText(value.skills.join(', '));
  }, [visible, value]);

  const apply = () => {
    onApply({
      ...draft,
      skills: skillsText.split(',').map((item) => item.trim()).filter(Boolean),
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
            <FieldLabel text="Pozicija" />
            <PositionPicker value={draft.position} onChange={(position) => setDraft((prev) => ({ ...prev, position }))} />

            <FieldLabel text="Lokacija" />
            <TextInput
              value={draft.location}
              onChangeText={(location) => setDraft((prev) => ({ ...prev, location }))}
              placeholder="Grad ili deo adrese"
              placeholderTextColor={COLORS.lightGray}
              style={styles.input}
            />

            <FieldLabel text={mode === 'candidate' ? 'Vestine koje oglas mora da trazi' : 'Obavezne vestine kandidata'} />
            <TextInput
              value={skillsText}
              onChangeText={setSkillsText}
              placeholder="React, prodaja, Excel..."
              placeholderTextColor={COLORS.lightGray}
              style={styles.input}
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
                setSkillsText('');
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
  label: { color: COLORS.textSoft, fontSize: 12, fontWeight: '900', marginBottom: 8, marginTop: 5 },
  input: { minHeight: 52, borderRadius: 15, backgroundColor: COLORS.input, borderWidth: 1, borderColor: COLORS.border, color: COLORS.white, paddingHorizontal: 14, marginBottom: 14 },
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

