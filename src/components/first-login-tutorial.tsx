import 'expo-sqlite/localStorage/install';

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TooltipProps, useCopilot } from 'react-native-copilot';
import { COLORS } from '../constants';
import { UserType } from '../types';
import { isTutorialFlowPaused, openTutorialTab, requestProfileTutorial } from '../utils/tutorial-flow';

export function JobHopTutorialTooltip({ labels }: TooltipProps) {
  const { currentStep, currentStepNumber, totalStepsNumber, isLastStep, goToNext, stop } = useCopilot();

  const continueAfterNavigation = (route?: 'Swipe' | 'Jobs' | 'Matches' | 'Profile') => {
    if (route) openTutorialTab(route);
    setTimeout(() => {
      void goToNext();
    }, route ? 350 : 0);
  };

  const handleNext = () => {
    const stepName = currentStep?.name || '';

    if (stepName.includes('Profil')) {
      requestProfileTutorial();
      openTutorialTab('Profile');
      void stop();
      return;
    }

    if (stepName.includes('Oglasi za tebe')) {
      continueAfterNavigation('Matches');
      return;
    }

    if (stepName.includes('Tvoji me') || stepName.includes('Tvoji meč')) {
      continueAfterNavigation('Swipe');
      return;
    }

    if (stepName.includes('Oglasi i analitika')) {
      continueAfterNavigation('Swipe');
      return;
    }

    if (stepName.includes('Kandidati za oglas')) {
      continueAfterNavigation('Matches');
      return;
    }

  if (stepName.includes('Mečevi') || stepName.includes('Me')) {
      continueAfterNavigation('Profile');
      return;
    }

    continueAfterNavigation();
  };

  return (
    <View style={styles.tooltip}>
      <View style={styles.tooltipTop}>
        <View style={styles.iconBox}><Ionicons name="sparkles" size={21} color={COLORS.primarySoft} /></View>
        <Text style={styles.counter}>{currentStepNumber}/{totalStepsNumber}</Text>
      </View>
      <Text style={styles.title}>{currentStep?.name.split('-').slice(1).join(' ') || 'JobHop'}</Text>
      <Text style={styles.body}>{currentStep?.text}</Text>
      <View style={styles.dots}>
        {Array.from({ length: totalStepsNumber }).map((_, index) => (
          <View key={index} style={[styles.dot, index + 1 === currentStepNumber && styles.dotActive]} />
        ))}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.skipButton} onPress={stop}>
          <Text style={styles.skipText}>{labels.skip || 'Preskoči'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={isLastStep ? stop : handleNext}>
          <Text style={styles.nextText}>{isLastStep ? labels.finish || 'Završi' : labels.next || 'Nastavi'}</Text>
          <Ionicons name={isLastStep ? 'checkmark' : 'arrow-forward'} size={17} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FirstLoginTutorial({ userId, userType }: { userId: string; userType: UserType }) {
  const { start, copilotEvents, totalStepsNumber, visible } = useCopilot();
  const started = useRef(false);
  const expectedSteps = userType === 'company' ? 4 : 4;
  const tutorialVersion = userType === 'company' ? 'copilot-company-v17' : 'copilot-v15';
  const storageKey = `jobhop:tutorial:${tutorialVersion}:${userType}:${userId}`;

  useEffect(() => {
    const markComplete = () => {
      if (!isTutorialFlowPaused()) localStorage.setItem(storageKey, 'done');
    };
    copilotEvents.on('stop', markComplete);
    return () => {
      copilotEvents.off('stop', markComplete);
    };
  }, [copilotEvents, storageKey]);

  useEffect(() => {
    if (started.current || visible || totalStepsNumber < expectedSteps || localStorage.getItem(storageKey) === 'done') return;
    const handler = setTimeout(() => {
      started.current = true;
      if (userType === 'company') {
        openTutorialTab('Jobs');
        setTimeout(() => {
          start('korak-Oglasi i analitika').catch(() => { started.current = false; });
        }, 450);
        return;
      }
      start().catch(() => { started.current = false; });
    }, userType === 'company' ? 700 : 500);
    return () => clearTimeout(handler);
  }, [expectedSteps, start, storageKey, totalStepsNumber, userType, visible]);

  return null;
}

const styles = StyleSheet.create({
  tooltip: { width: '100%', padding: 18, borderRadius: 22, backgroundColor: '#121622', borderWidth: 1, borderColor: '#353c5a', boxShadow: '0px 20px 48px rgba(0,0,0,0.46)' },
  tooltipTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(108,99,255,0.17)' },
  counter: { color: COLORS.textMuted, fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  title: { color: COLORS.white, fontSize: 21, fontWeight: '900', textTransform: 'capitalize', marginTop: 12 },
  body: { color: COLORS.textSoft, fontSize: 14, lineHeight: 21, marginTop: 7 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34394c' },
  dotActive: { width: 24, backgroundColor: COLORS.primarySoft },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 15 },
  skipButton: { minHeight: 44, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '800' },
  nextButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 17, borderRadius: 14, backgroundColor: COLORS.primary },
  nextText: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
});
