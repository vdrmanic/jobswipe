import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { COLORS } from '../constants';
import { MatchScore } from '../types';

export default function MatchScorePill({ result }: { result: MatchScore }) {
  const [visible, setVisible] = useState(false);
  const color = result.score >= 75 ? COLORS.mint : result.score >= 50 ? COLORS.gold : COLORS.textMuted;

  return (
    <>
      <TouchableOpacity style={[styles.pill, { borderColor: `${color}66` }]} onPress={() => setVisible(true)}>
        <Ionicons name="sparkles" size={13} color={color} />
        <Text style={[styles.pillText, { color }]}>{result.score}% poklapanje</Text>
      </TouchableOpacity>
      <Modal transparent animationType="fade" visible={visible} onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.scoreCircle}>
              <Text style={styles.score}>{result.score}%</Text>
            </View>
            <Text style={styles.title}>Zasto ovaj rezultat?</Text>
            {(result.reasons.length ? result.reasons : ['Profil nema dovoljno podataka za precizniji rezultat.']).map((reason) => (
              <View key={reason} style={styles.reason}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.mint} />
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.button} onPress={() => setVisible(false)}>
              <Text style={styles.buttonText}>Razumem</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(10,12,20,0.82)' },
  pillText: { fontSize: 10, fontWeight: '900' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, borderRadius: 22, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, padding: 20, alignItems: 'center' },
  scoreCircle: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.18)', borderWidth: 1, borderColor: COLORS.primary },
  score: { color: COLORS.white, fontSize: 23, fontWeight: '900' },
  title: { color: COLORS.white, fontSize: 20, fontWeight: '900', marginVertical: 16 },
  reason: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9 },
  reasonText: { color: COLORS.textSoft, fontSize: 13, lineHeight: 18, flex: 1 },
  button: { width: '100%', minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, marginTop: 14 },
  buttonText: { color: COLORS.white, fontWeight: '900' },
});
