import { ReactNode, useRef, useMemo, useEffect } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type SwipeCardProps = {
  children: ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  bottomSpacing?: number;
  cardHeight?: number;
};

export default function SwipeCard({ children, onSwipeLeft, onSwipeRight, bottomSpacing = 100, cardHeight }: SwipeCardProps) {
  const position = useRef(new Animated.ValueXY()).current;

  // Reset position when callbacks change (new card)
  useEffect(() => {
    position.setValue({ x: 0, y: 0 });
  }, [onSwipeLeft, onSwipeRight, position]);

  const rotate = position.x.interpolate({
    inputRange: [-220, 0, 220],
    outputRange: ['-14deg', '0deg', '14deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [30, 90],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const skipOpacity = position.x.interpolate({
    inputRange: [-90, -30],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const likeScale = position.x.interpolate({
    inputRange: [0, 120],
    outputRange: [0.95, 1.08],
    extrapolate: 'clamp',
  });

  const skipScale = position.x.interpolate({
    inputRange: [-120, 0],
    outputRange: [1.08, 0.95],
    extrapolate: 'clamp',
  });

  const leftFeedbackOpacity = position.x.interpolate({
    inputRange: [-120, -40, 0],
    outputRange: [0.8, 0.35, 0],
    extrapolate: 'clamp',
  });

  const rightFeedbackOpacity = position.x.interpolate({
    inputRange: [0, 40, 120],
    outputRange: [0, 0.35, 0.8],
    extrapolate: 'clamp',
  });

  const feedbackTranslate = position.x.interpolate({
    inputRange: [-120, 0, 120],
    outputRange: [-24, 0, 24],
    extrapolate: 'clamp',
  });

  const badgeRotate = position.x.interpolate({
    inputRange: [-140, 0, 140],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });

  const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          return Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy);
        },
        onMoveShouldSetPanResponderCapture: (_, gesture) => {
          return Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy);
        },
        onPanResponderMove: (_, gesture) => {
          position.setValue({ x: gesture.dx, y: gesture.dy * 0.35 });
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 120) {
            Animated.timing(position, {
              toValue: { x: 500, y: gesture.dy * 0.35 },
              duration: 220,
              useNativeDriver: false,
            }).start(() => {
              position.setValue({ x: 0, y: 0 });
              onSwipeRight();
            });
          } else if (gesture.dx < -120) {
            Animated.timing(position, {
              toValue: { x: -500, y: gesture.dy * 0.35 },
              duration: 220,
              useNativeDriver: false,
            }).start(() => {
              position.setValue({ x: 0, y: 0 });
              onSwipeLeft();
            });
          } else {
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              friction: 7,
              tension: 45,
              useNativeDriver: false,
            }).start();
          }
        },
      }),
    [onSwipeLeft, onSwipeRight, position]
  );


  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(Math.max(width * 0.9, 320), 430);
  const resolvedCardHeight = cardHeight ?? Math.min(Math.max(height * 0.68, 520), 680);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.wrapper,
        {
          width: cardWidth,
          height: resolvedCardHeight,
          minHeight: cardHeight ? 0 : 520,
          marginBottom: bottomSpacing,
          transform: [
            { translateX: position.x },
            { translateY: position.y },
            { rotate },
          ],
        },
      ]}
    >
      <View style={styles.inner}>{children}</View>

      <AnimatedGradient
        colors={[ 'rgba(255, 112, 121, 0.84)', 'rgba(255, 112, 121, 0.0)' ]}
        start={[0, 0.5]}
        end={[1, 0.5]}
        style={[styles.gradientAccent, styles.leftGradient, { opacity: leftFeedbackOpacity, pointerEvents: 'none' }]}
      />

      <AnimatedGradient
        colors={[ 'rgba(105, 214, 255, 0.82)', 'rgba(105, 214, 255, 0.0)' ]}
        start={[1, 0.5]}
        end={[0, 0.5]}
        style={[styles.gradientAccent, styles.rightGradient, { opacity: rightFeedbackOpacity, pointerEvents: 'none' }]}
      />

      <Animated.View style={[styles.feedbackBadge, styles.skipBadge, { opacity: skipOpacity, transform: [{ scale: skipScale }, { translateX: feedbackTranslate }, { rotate: badgeRotate }], pointerEvents: 'none' }]}> 
        <Text style={styles.statusText}>PRESKOČI</Text>
      </Animated.View>
      <Animated.View style={[styles.feedbackBadge, styles.likeBadge, { opacity: likeOpacity, transform: [{ scale: likeScale }, { translateX: feedbackTranslate }, { rotate: badgeRotate }], pointerEvents: 'none' }]}> 
        <Text style={styles.statusText}>LAJK</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
    minWidth: 0,
    minHeight: 520,
    boxShadow: '0px 18px 24px rgba(0, 0, 0, 0.18)',
    elevation: 12,
    ...Platform.select({
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 18 },
      },
    }),
  },
  inner: {
    flex: 1,
  },
  gradientAccent: {
    position: 'absolute',
    bottom: 12,
    height: 72,
    width: '68%',
    borderRadius: 36,
    zIndex: 1,
    opacity: 0.9,
  },
  leftGradient: {
    left: -10,
    transform: [{ translateX: -12 }, { rotate: '-8deg' }],
  },
  rightGradient: {
    right: -10,
    transform: [{ translateX: 12 }, { rotate: '8deg' }],
  },
  feedbackBadge: {
    position: 'absolute',
    top: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 32,
    borderWidth: 1.5,
    zIndex: 3,
    backgroundColor: 'rgba(10, 10, 12, 0.9)',
    boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.28)',
    elevation: 10,
    ...Platform.select({
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
  },
  statusText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  likeBadge: {
    right: 18,
    borderColor: '#4ade80',
    backgroundColor: 'rgba(74,222,128,0.18)',
  },
  skipBadge: {
    left: 18,
    borderColor: '#e63946',
    backgroundColor: 'rgba(230,57,70,0.18)',
  },
});
