import { useEffect } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  BounceIn,
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { COLORS } from '../constants';

type MatchCelebrationProps = {
  candidateAvatar?: string | null;
  candidateName?: string | null;
  companyAvatar?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  visible: boolean;
  onContinue: () => void;
};

const sparks = [
  { left: '9%', top: '14%', size: 8, color: COLORS.accent, delay: 80 },
  { left: '18%', top: '31%', size: 5, color: COLORS.gold, delay: 180 },
  { left: '29%', top: '9%', size: 7, color: COLORS.secondary, delay: 260 },
  { left: '42%', top: '20%', size: 4, color: COLORS.primarySoft, delay: 340 },
  { right: '8%', top: '19%', size: 7, color: COLORS.mint, delay: 120 },
  { right: '20%', top: '37%', size: 5, color: COLORS.gold, delay: 220 },
  { right: '31%', top: '8%', size: 8, color: COLORS.accent, delay: 300 },
  { left: '12%', bottom: '18%', size: 6, color: COLORS.primarySoft, delay: 380 },
  { right: '13%', bottom: '22%', size: 6, color: COLORS.secondary, delay: 440 },
] as const;

function Avatar({ uri, icon }: { uri?: string | null; icon: 'person' | 'business' }) {
  return (
    <LinearGradient colors={['rgba(124,92,255,0.95)', 'rgba(54,209,220,0.72)']} style={styles.avatarRing}>
      <View style={styles.avatarInner}>
        {uri ? (
          <Image source={{ uri }} style={styles.avatarImage} />
        ) : (
          <Ionicons name={icon} size={42} color={COLORS.primarySoft} />
        )}
      </View>
    </LinearGradient>
  );
}

export default function MatchCelebration({
  candidateAvatar,
  candidateName,
  companyAvatar,
  companyName,
  jobTitle,
  visible,
  onContinue,
}: MatchCelebrationProps) {
  const pulse = useSharedValue(0);
  const orbit = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (!visible) return undefined;

    pulse.value = 0;
    orbit.value = 0;
    float.value = 0;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
    orbit.value = withRepeat(withTiming(1, { duration: 11000, easing: Easing.linear }), -1);
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );

    return () => {
      cancelAnimation(pulse);
      cancelAnimation(orbit);
      cancelAnimation(float);
    };
  }, [visible, float, orbit, pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.45, 0.9]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.9, 1.16]) }],
  }));
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value * 360}deg` }],
  }));
  const reverseOrbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-orbit.value * 360}deg` }],
  }));
  const candidateFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(float.value, [0, 1], [4, -7]) }],
  }));
  const companyFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(float.value, [0, 1], [-7, 4]) }],
  }));
  const connectionPulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.55, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.9, 1.1]) }],
  }));
  const sparkFloatStyle = useAnimatedStyle(() => ({
    opacity: interpolate(float.value, [0, 1], [0.45, 1]),
    transform: [{ translateY: interpolate(float.value, [0, 1], [5, -8]) }],
  }));

  return (
    <Modal
      transparent
      statusBarTranslucent
      animationType="none"
      visible={visible}
      onRequestClose={onContinue}
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={['rgba(7,8,13,0.98)', 'rgba(37,24,78,0.98)', 'rgba(7,8,13,0.99)']}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View style={[styles.glowOne, glowStyle]} />
        <Animated.View style={[styles.glowTwo, glowStyle]} />
        <Animated.View style={[styles.orbit, styles.orbitLarge, orbitStyle]}>
          <View style={[styles.orbitPlanet, styles.orbitPlanetPrimary]} />
          <View style={[styles.orbitPlanet, styles.orbitPlanetGold]} />
        </Animated.View>
        <Animated.View style={[styles.orbit, styles.orbitSmall, reverseOrbitStyle]}>
          <View style={[styles.orbitPlanet, styles.orbitPlanetMint]} />
        </Animated.View>

        {sparks.map((spark, index) => (
          <Animated.View
            key={index}
            entering={ZoomIn.delay(spark.delay).springify().damping(9)}
            style={[
              styles.spark,
              sparkFloatStyle,
              {
                left: 'left' in spark ? spark.left : undefined,
                right: 'right' in spark ? spark.right : undefined,
                top: 'top' in spark ? spark.top : undefined,
                bottom: 'bottom' in spark ? spark.bottom : undefined,
                width: spark.size,
                height: spark.size,
                borderRadius: spark.size / 2,
                backgroundColor: spark.color,
              },
            ]}
          />
        ))}

        <Animated.View entering={FadeInUp.duration(450)} style={styles.eyebrow}>
          <Ionicons name="sparkles" size={15} color={COLORS.gold} />
          <Text style={styles.eyebrowText}>NOVA POSLOVNA PRICA</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.titleStack}>
          <Text style={styles.titleGhost}>MATCH</Text>
          <Text style={styles.title}>It's a match!</Text>
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(240).duration(450)} style={styles.subtitle}>
          Oboje ste pokazali interesovanje. Vreme je za prvi razgovor.
        </Animated.Text>

        <View style={styles.peopleRow}>
          <Animated.View entering={FadeInDown.delay(180).springify()} style={[styles.person, candidateFloatStyle]}>
            <Avatar uri={candidateAvatar} icon="person" />
            <Text style={styles.role}>KANDIDAT</Text>
            <Text style={styles.name} numberOfLines={1}>{candidateName || 'Ti'}</Text>
          </Animated.View>

          <Animated.View entering={BounceIn.delay(420)} style={[styles.connection, connectionPulseStyle]}>
            <LinearGradient colors={[COLORS.secondary, COLORS.primary, COLORS.accent]} style={styles.heartBubble}>
              <Ionicons name="heart" size={28} color={COLORS.white} />
            </LinearGradient>
            <LinearGradient colors={[COLORS.accent, COLORS.primarySoft, COLORS.secondary]} style={styles.connectionLine} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(260).springify()} style={[styles.person, companyFloatStyle]}>
            <Avatar uri={companyAvatar} icon="business" />
            <Text style={styles.role}>FIRMA</Text>
            <Text style={styles.name} numberOfLines={1}>{companyName || 'Firma'}</Text>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(520).springify()} style={styles.actionCard}>
          <View style={styles.actionIcon}>
            <Ionicons name="chatbubbles" size={22} color={COLORS.primarySoft} />
          </View>
          <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Match je sačuvan{jobTitle ? ` za ${jobTitle}` : ''}</Text>
            <Text style={styles.actionText}>Pronaći ćeš ga u tabu Mečevi i tamo možeš započeti razgovor.</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(650).springify()} style={styles.buttonWrap}>
          <TouchableOpacity activeOpacity={0.86} onPress={onContinue} style={styles.buttonTouch}>
            <LinearGradient colors={[COLORS.primary, '#9B6DFF']} style={styles.button}>
              <Text style={styles.buttonText}>Nastavi</Text>
              <Ionicons name="arrow-forward" size={19} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    overflow: 'hidden',
  },
  glowOne: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    top: -150,
    right: -150,
    backgroundColor: 'rgba(124,92,255,0.30)',
  },
  glowTwo: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    bottom: -140,
    left: -120,
    backgroundColor: 'rgba(54,209,220,0.22)',
  },
  orbit: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(232,227,255,0.10)',
    borderStyle: 'dashed',
  },
  orbitLarge: { width: 560, height: 560, borderRadius: 280 },
  orbitSmall: { width: 390, height: 390, borderRadius: 195, borderColor: 'rgba(54,209,220,0.12)' },
  orbitPlanet: { position: 'absolute', width: 11, height: 11, borderRadius: 6 },
  orbitPlanetPrimary: { top: 35, left: 105, backgroundColor: COLORS.primary, boxShadow: '0px 0px 18px rgba(124,92,255,0.9)' },
  orbitPlanetGold: { right: 30, bottom: 125, backgroundColor: COLORS.gold, boxShadow: '0px 0px 18px rgba(248,196,92,0.8)' },
  orbitPlanetMint: { left: -5, top: 188, backgroundColor: COLORS.mint, boxShadow: '0px 0px 16px rgba(74,222,128,0.8)' },
  spark: { position: 'absolute' },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(248,196,92,0.34)',
    backgroundColor: 'rgba(248,196,92,0.10)',
    marginBottom: 15,
  },
  eyebrowText: { color: COLORS.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  titleStack: { minHeight: 60, alignItems: 'center', justifyContent: 'center' },
  titleGhost: {
    position: 'absolute',
    color: 'rgba(124,92,255,0.13)',
    fontSize: 76,
    lineHeight: 82,
    fontWeight: '900',
    letterSpacing: 8,
  },
  title: {
    color: COLORS.white,
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '900',
    letterSpacing: -1.4,
    textShadowColor: 'rgba(124,92,255,0.72)',
    textShadowOffset: { width: 0, height: 5 },
    textShadowRadius: 22,
  },
  subtitle: {
    color: COLORS.textMuted,
    maxWidth: 430,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  peopleRow: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  person: { flex: 1, minWidth: 0, alignItems: 'center' },
  avatarRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    padding: 3,
    boxShadow: '0px 18px 40px rgba(0,0,0,0.42)',
  },
  avatarInner: {
    flex: 1,
    borderRadius: 53,
    backgroundColor: COLORS.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: COLORS.dark,
  },
  avatarImage: { width: '100%', height: '100%' },
  role: { color: COLORS.primarySoft, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 10 },
  name: { color: COLORS.white, fontSize: 15, fontWeight: '800', marginTop: 4, maxWidth: 130 },
  connection: { width: 72, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  heartBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    boxShadow: '0px 10px 30px rgba(255,95,126,0.34)',
  },
  connectionLine: {
    position: 'absolute',
    height: 3,
    width: 104,
    borderRadius: 999,
  },
  actionCard: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
    marginTop: 28,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,92,255,0.18)',
  },
  actionCopy: { flex: 1 },
  actionTitle: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
  actionText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  buttonWrap: { width: '100%', maxWidth: 440, marginTop: 14 },
  buttonTouch: { borderRadius: 18, overflow: 'hidden' },
  button: {
    minHeight: 56,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    boxShadow: '0px 16px 38px rgba(124,92,255,0.38)',
  },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
});
