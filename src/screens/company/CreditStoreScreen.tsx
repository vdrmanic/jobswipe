import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TEST_CREDIT_PACKAGES, creditService } from '../../services';

const packages = [
  {
    credits: 3,
    title: 'Starter',
    fakePrice: 'Uskoro',
    duration: 'do 30 dana oglasa',
    badge: 'Za probu',
    icon: 'rocket-outline' as const,
    gradient: ['#6C63FF', '#36D1DC'],
    bullets: ['1 oglas od 30 dana', 'idealno za prvi test', 'bez obaveze'],
    featured: false,
  },
  {
    credits: 10,
    title: 'Growth',
    fakePrice: 'Uskoro',
    duration: 'više aktivnih oglasa',
    badge: 'Preporučeno',
    icon: 'flash-outline' as const,
    gradient: ['#FF4BA0', '#7C5CFF'],
    bullets: ['više oglasa paralelno', 'najbolji balans', 'za redovno zapošljavanje'],
    featured: true,
  },
  {
    credits: 25,
    title: 'Scale',
    fakePrice: 'Uskoro',
    duration: 'za ozbiljan hiring',
    badge: 'Najviše kredita',
    icon: 'business-outline' as const,
    gradient: ['#F8C45C', '#FF7A59'],
    bullets: ['za timove i agencije', 'duže kampanje', 'spremno za kasniji checkout'],
    featured: false,
  },
] as const;

const rules = [
  { credits: '1', label: '7 dana', icon: 'calendar-outline' as const },
  { credits: '2', label: '14 dana', icon: 'calendar-number-outline' as const },
  { credits: '3', label: '30 dana', icon: 'sparkles-outline' as const },
];

export default function CreditStoreScreen({ navigation }: any) {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyCredits, setBusyCredits] = useState<number | null>(null);

  const loadBalance = async () => {
    try {
      const nextBalance = await creditService.getBalance();
      setBalance(nextBalance);
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBalance();
    }, [])
  );

  const simulatePurchase = async (credits: (typeof TEST_CREDIT_PACKAGES)[number]['credits']) => {
    setBusyCredits(credits);
    try {
      const nextBalance = await creditService.addTestCredits(credits);
      setBalance(nextBalance);
      Alert.alert('Krediti dodati', `Dodato je ${credits} kredita na test nalog.`);
    } catch (error: any) {
      Alert.alert('Kupovina nije završena', error?.message || 'Pokušaj ponovo.');
    } finally {
      setBusyCredits(null);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#050711', '#111B35', '#080914']} style={StyleSheet.absoluteFill} />
      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.liveBalance}>
            <Text style={styles.liveBalanceLabel}>Tvoje stanje</Text>
            <View style={styles.liveBalanceRow}>
              <Ionicons name="wallet" size={18} color="#C4B5FD" />
              <Text style={styles.liveBalanceValue}>{loading ? '...' : balance}</Text>
              <Text style={styles.liveBalanceUnit}>kredita</Text>
            </View>
          </View>
        </View>

        <LinearGradient colors={['rgba(124,92,255,0.34)', 'rgba(54,209,220,0.10)']} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="diamond-outline" size={28} color="#fff" />
            </View>
            <Text style={styles.heroBadge}>KREDITI ZA POSLODAVCE</Text>
          </View>
          <Text style={styles.heroTitle}>Dopuni kredite. Drži najbolje oglase na vrhu igre.</Text>
          <Text style={styles.heroText}>
            Kandidati su besplatni. Firma troši kredite samo kada aktivira ili produžava oglas.
          </Text>

          <View style={styles.ruleStrip}>
            {rules.map((rule) => (
              <View key={rule.credits} style={styles.ruleChip}>
                <Ionicons name={rule.icon} size={16} color="#D9D3FF" />
                <Text style={styles.ruleChipText}>{rule.credits} = {rule.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>PAKETI</Text>
            <Text style={styles.sectionTitle}>Izaberi paket kredita</Text>
          </View>
          <Text style={styles.sectionHint}>Checkout stiže kasnije</Text>
        </View>

        {packages.map((pack) => {
          const testPackage = TEST_CREDIT_PACKAGES.find((item) => item.credits === pack.credits);
          return (
            <View key={pack.credits} style={[styles.packageShell, pack.featured && styles.packageFeatured]}>
              {pack.featured && (
                <LinearGradient colors={['#FF4BA0', '#7C5CFF']} style={styles.recommendedRibbon}>
                  <Text style={styles.recommendedText}>NAJBOLJI IZBOR</Text>
                </LinearGradient>
              )}

              <View style={styles.packageHeader}>
                <LinearGradient colors={pack.gradient as any} style={styles.packageIcon}>
                  <Ionicons name={pack.icon} size={25} color="#fff" />
                </LinearGradient>
                <View style={styles.packageTitleWrap}>
                  <Text style={styles.packageBadge}>{pack.badge}</Text>
                  <Text style={styles.packageTitle}>{pack.title}</Text>
                </View>
                <View style={styles.creditBubble}>
                  <Text style={styles.creditNumber}>{pack.credits}</Text>
                  <Text style={styles.creditText}>kredita</Text>
                </View>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.fakePrice}>{pack.fakePrice}</Text>
                <Text style={styles.duration}>{pack.duration}</Text>
              </View>

              <View style={styles.bulletList}>
                {pack.bullets.map((bullet) => (
                  <View key={bullet} style={styles.bulletRow}>
                    <Ionicons name="checkmark-circle" size={17} color="#86EFAC" />
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.buyButton, pack.featured && styles.buyButtonFeatured]}
                disabled={!testPackage || busyCredits === pack.credits}
                onPress={() => testPackage && simulatePurchase(testPackage.credits)}
              >
                {busyCredits === pack.credits ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.buyButtonText}>Dodaj test kredite</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Šta se dešava posle kupovine?</Text>
          <View style={styles.timelineRow}>
            <View style={styles.timelineDot} />
            <Text style={styles.timelineText}>Krediti odmah ulaze na stanje firme.</Text>
          </View>
          <View style={styles.timelineRow}>
            <View style={styles.timelineDot} />
            <Text style={styles.timelineText}>Kod aktivacije oglasa biraš 7, 14 ili 30 dana.</Text>
          </View>
          <View style={styles.timelineRow}>
            <View style={styles.timelineDot} />
            <Text style={styles.timelineText}>Ako pauziraš oglas, preostalo plaćeno vreme ostaje validno.</Text>
          </View>
        </View>

        <View style={styles.noticeCard}>
          <Ionicons name="construct-outline" size={22} color="#F8C45C" />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>Plaćanje još nije povezano</Text>
            <Text style={styles.noticeText}>
              Ovo je finalni izgled stranice. Dugme trenutno dodaje test kredite, a kasnije ovde kačimo Stripe/Paddle checkout.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const glowShadow = Platform.select({
  web: { boxShadow: '0px 24px 54px rgba(0,0,0,0.34)' },
  default: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050711' },
  orbOne: { position: 'absolute', top: -120, right: -120, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(124,92,255,0.26)' },
  orbTwo: { position: 'absolute', top: 250, left: -150, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(54,209,220,0.14)' },
  content: { padding: 18, paddingTop: 24, paddingBottom: 42, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 46, height: 46, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  liveBalance: { alignItems: 'flex-end' },
  liveBalanceLabel: { color: '#8F9ABF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  liveBalanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(196,181,253,0.20)' },
  liveBalanceValue: { color: '#fff', fontWeight: '900', fontSize: 17 },
  liveBalanceUnit: { color: '#C4B5FD', fontWeight: '800', fontSize: 12 },
  heroCard: { padding: 20, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(199,210,254,0.20)', overflow: 'hidden', ...glowShadow },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  heroBadge: { color: '#DDE3FF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -0.8 },
  heroText: { color: '#D4DAF2', fontSize: 15, lineHeight: 23, marginTop: 12 },
  ruleStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  ruleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(6,8,18,0.42)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  ruleChipText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  sectionKicker: { color: '#8F9BFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 3 },
  sectionHint: { color: '#8992B3', fontSize: 12, fontWeight: '800' },
  packageShell: { position: 'relative', padding: 18, paddingTop: 20, borderRadius: 30, backgroundColor: 'rgba(16,20,33,0.96)', borderWidth: 1, borderColor: 'rgba(169,179,255,0.16)', gap: 15, overflow: 'hidden', ...glowShadow },
  packageFeatured: { borderColor: 'rgba(255,75,160,0.55)', backgroundColor: 'rgba(23,20,42,0.98)' },
  recommendedRibbon: { position: 'absolute', right: -42, top: 18, transform: [{ rotate: '35deg' }], paddingVertical: 6, paddingHorizontal: 44 },
  recommendedText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  packageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  packageIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  packageTitleWrap: { flex: 1 },
  packageBadge: { color: '#C4B5FD', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  packageTitle: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 2 },
  creditBubble: { alignItems: 'center', justifyContent: 'center', minWidth: 66, minHeight: 66, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  creditNumber: { color: '#fff', fontSize: 26, fontWeight: '900' },
  creditText: { color: '#98A3C4', fontSize: 10, fontWeight: '900', marginTop: -2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  fakePrice: { color: '#86EFAC', fontSize: 24, fontWeight: '900' },
  duration: { color: '#9DA7C8', fontSize: 13, fontWeight: '800' },
  bulletList: { gap: 9 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulletText: { color: '#D8DDF0', fontSize: 14, fontWeight: '700', flex: 1 },
  buyButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 18, backgroundColor: 'rgba(124,92,255,0.68)' },
  buyButtonFeatured: { backgroundColor: '#FF4BA0' },
  buyButtonText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  timelineCard: { gap: 12, padding: 17, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  timelineTitle: { color: '#fff', fontSize: 17, fontWeight: '900', marginBottom: 2 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#7C5CFF' },
  timelineText: { color: '#BFC7E2', lineHeight: 20, flex: 1 },
  noticeCard: { flexDirection: 'row', gap: 12, padding: 15, borderRadius: 22, backgroundColor: 'rgba(248,196,92,0.10)', borderWidth: 1, borderColor: 'rgba(248,196,92,0.24)' },
  noticeTitle: { color: '#fff', fontWeight: '900', marginBottom: 3 },
  noticeText: { color: '#D3C8B1', lineHeight: 20 },
});
