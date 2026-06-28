import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { JobListing } from '../../types';
import {
  CREDIT_DURATION_OPTIONS,
  CreditDuration,
  creditService,
  swipeService,
} from '../../services';

const DAY_MS = 24 * 60 * 60 * 1000;

type ConfirmAction =
  | { type: 'delete'; job: JobListing }
  | { type: 'boost'; job: JobListing }
  | { type: 'reset'; job: JobListing };

export default function CompanyJobsScreen({ navigation }: any) {
  const { user } = useAuth();

  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [creditBalance, setCreditBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creditModalJob, setCreditModalJob] = useState<JobListing | null>(null);
  const [creditBusy, setCreditBusy] = useState(false);
  const [boostBusyJobId, setBoostBusyJobId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const fetchJobs = async () => {
    if (!user) return;

    await creditService.expireOldJobs();

    const [{ data, error }, balance] = await Promise.all([
      supabase
        .from('job_listings')
        .select('*')
        .eq('company_id', user.id)
        .order('created_at', { ascending: false }),
      creditService.getBalance().catch(() => 0),
    ]);

    if (error) {
      Alert.alert('Greška', error.message);
    } else {
      setJobs((data || []) as JobListing[]);
      setCreditBalance(balance);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [user?.id])
  );

  const stats = useMemo(() => {
    const now = Date.now();
    const active = jobs.filter((job) => (job.is_active || job.status === 'active') && (!job.expires_at || new Date(job.expires_at).getTime() > now)).length;
    const paused = jobs.filter((job) => job.status === 'paused' || (!job.is_active && job.status !== 'expired')).length;
    const expiringSoon = jobs.filter((job) => {
      if (!job.expires_at) return false;
      const expiresAt = new Date(job.expires_at).getTime();
      return expiresAt > now && expiresAt - now <= 3 * DAY_MS;
    }).length;
    const boosted = jobs.filter((job) => job.boost_until && new Date(job.boost_until).getTime() > now).length;

    return { active, paused, expiringSoon, boosted };
  }, [jobs]);

  const updateJobStatus = async (jobId: string, status: 'paused' | 'filled') => {
    const { error } = await supabase
      .from('job_listings')
      .update({
        status,
        is_active: false,
      })
      .eq('id', jobId);

    if (error) {
      Alert.alert('Greška', error.message);
      return;
    }

    fetchJobs();
  };

  const deleteJob = (job: JobListing) => {
    setConfirmAction({ type: 'delete', job });
  };

  const activateWithCredits = async (credits: CreditDuration) => {
    if (!creditModalJob) return;

    setCreditBusy(true);
    try {
      await creditService.activateJob(creditModalJob.id, credits);
      setCreditModalJob(null);
      await fetchJobs();
    } catch (error: any) {
      Alert.alert('Oglas nije aktiviran', error?.message || 'Dodaj kredite pa pokušaj ponovo.');
    } finally {
      setCreditBusy(false);
    }
  };

  const hasPaidTimeLeft = (job: JobListing) => !!job.expires_at && new Date(job.expires_at).getTime() > Date.now();

  const isBoosted = (job: JobListing) => !!job.boost_until && new Date(job.boost_until).getTime() > Date.now();

  const handleActivatePress = async (job: JobListing) => {
    if (job.is_active || !hasPaidTimeLeft(job)) {
      setCreditModalJob(job);
      return;
    }

    setCreditBusy(true);
    try {
      await creditService.resumePaidJob(job.id);
      await fetchJobs();
    } catch (error: any) {
      Alert.alert('Oglas nije aktiviran', error?.message || 'Pokušaj ponovo.');
    } finally {
      setCreditBusy(false);
    }
  };

  const handleBoostPress = (job: JobListing) => {
    if (!job.is_active || job.status !== 'active' || !hasPaidTimeLeft(job)) {
      Alert.alert('Boost nije dostupan', 'Prvo aktiviraj oglas. Boost može da radi samo dok oglas ima aktivan plaćeni period.');
      return;
    }

    setConfirmAction({ type: 'boost', job });
  };

  const handleResetPress = (job: JobListing) => {
    setConfirmAction({ type: 'reset', job });
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;

    setConfirmBusy(true);
    try {
      if (confirmAction.type === 'delete') {
        const { error } = await supabase.from('job_listings').delete().eq('id', confirmAction.job.id);
        if (error) throw error;
      } else if (confirmAction.type === 'reset') {
        const count = await swipeService.resetCompanyJobDecisions(confirmAction.job.id);
        Alert.alert(
          count > 0 ? 'Odluke su resetovane' : 'Nema odluka za reset',
          count > 0
            ? `Resetovano je ${count} odluka starijih od 30 dana za ovaj oglas. Ti kandidati mogu opet da se pojave.`
            : 'Za ovaj oglas još nema odluka starijih od 30 dana.'
        );
      } else {
        setBoostBusyJobId(confirmAction.job.id);
        await creditService.boostJob(confirmAction.job.id);
      }

      setConfirmAction(null);
      await fetchJobs();
    } catch (error: any) {
      Alert.alert(
        confirmAction.type === 'delete' ? 'Oglas nije obrisan' : confirmAction.type === 'reset' ? 'Reset nije uspeo' : 'Boost nije aktiviran',
        error?.message || 'Pokušaj ponovo.'
      );
    } finally {
      setConfirmBusy(false);
      setBoostBusyJobId(null);
    }
  };

  const getStatusMeta = (job: JobListing) => {
    if (job.is_draft) return { label: 'Nacrt', icon: 'document-text-outline' as const, color: '#BFC7FF', bg: 'rgba(191,199,255,0.12)' };
    if (job.status === 'expired') return { label: 'Istekao', icon: 'time-outline' as const, color: '#FB923C', bg: 'rgba(251,146,60,0.14)' };
    if (job.status === 'filled') return { label: 'Popunjen', icon: 'checkmark-done-outline' as const, color: '#FACC15', bg: 'rgba(250,204,21,0.12)' };
    if (job.status === 'paused') return { label: 'Pauziran', icon: 'pause-outline' as const, color: '#F87171', bg: 'rgba(248,113,113,0.12)' };
    if (job.status === 'active' || job.is_active) return { label: 'Aktivan', icon: 'radio-button-on-outline' as const, color: '#4ADE80', bg: 'rgba(74,222,128,0.12)' };
    return { label: 'Pauziran', icon: 'pause-outline' as const, color: '#F87171', bg: 'rgba(248,113,113,0.12)' };
  };

  const formatExpiry = (value?: string | null) => {
    if (!value) return 'nije plaćeno';
    return new Date(value).toLocaleDateString('sr-RS', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDaysLeft = (value?: string | null) => {
    if (!value) return 'Bez aktivnog perioda';
    const daysLeft = Math.ceil((new Date(value).getTime() - Date.now()) / DAY_MS);
    if (daysLeft <= 0) return 'Isteklo';
    if (daysLeft === 1) return 'Još 1 dan';
    return `Još ${daysLeft} dana`;
  };

  const formatBoost = (value?: string | null) => {
    if (!value) return 'Nije boostovan';
    const hoursLeft = Math.ceil((new Date(value).getTime() - Date.now()) / (60 * 60 * 1000));
    if (hoursLeft <= 0) return 'Boost je istekao';
    if (hoursLeft === 1) return 'Boost još 1h';
    return `Boost još ${hoursLeft}h`;
  };

  const getPrimaryActionLabel = (job: JobListing) => {
    if (job.is_active || job.status === 'active') return 'Produži';
    if (hasPaidTimeLeft(job)) return 'Nastavi';
    return 'Aktiviraj';
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C5CFF" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#050711', '#10172C', '#070811']} style={StyleSheet.absoluteFill} />
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor="#7C5CFF"
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchJobs();
            }}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>HIRING DASHBOARD</Text>
            <Text style={styles.title}>Oglasi</Text>
            <Text style={styles.subtitle}>Kontroliši kampanje, kredite i kandidate iz jednog mesta.</Text>
          </View>

          <TouchableOpacity style={styles.newJobButton} onPress={() => navigation.navigate('CreateJob')}>
            <LinearGradient colors={['#7C5CFF', '#36D1DC']} style={styles.newJobGradient}>
              <Ionicons name="add" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <LinearGradient colors={['rgba(124,92,255,0.30)', 'rgba(54,209,220,0.10)']} style={styles.commandCard}>
          <View style={styles.commandTop}>
            <View style={styles.commandIcon}>
              <Ionicons name="megaphone-outline" size={24} color="#fff" />
            </View>
            <View style={styles.commandTextWrap}>
              <Text style={styles.commandLabel}>Aktivne kampanje</Text>
              <Text style={styles.commandTitle}>
                {stats.active} aktivno / {jobs.length} ukupno
              </Text>
            </View>
            <View style={styles.creditPill}>
              <Ionicons name="wallet-outline" size={16} color="#C4B5FD" />
              <Text style={styles.creditPillText}>{creditBalance}</Text>
            </View>
          </View>

          <View style={styles.statGrid}>
            <View style={styles.statCard}>
              <Ionicons name="pulse-outline" size={18} color="#86EFAC" />
              <Text style={styles.statValue}>{stats.active}</Text>
              <Text style={styles.statLabel}>aktivna</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="pause-circle-outline" size={18} color="#FCA5A5" />
              <Text style={styles.statValue}>{stats.paused}</Text>
              <Text style={styles.statLabel}>pauzirana</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="hourglass-outline" size={18} color="#F8C45C" />
              <Text style={styles.statValue}>{stats.expiringSoon}</Text>
              <Text style={styles.statLabel}>ističe uskoro</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="flame-outline" size={18} color="#FFB86B" />
              <Text style={styles.statValue}>{stats.boosted}</Text>
              <Text style={styles.statLabel}>boost</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.creditCta} onPress={() => navigation.navigate('CreditStore')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.creditCtaTitle}>Dopuni kredite</Text>
              <Text style={styles.creditCtaText}>1 kredit = 7 dana, 2 = 14 dana, 3 = 30 dana oglasa.</Text>
            </View>
            <View style={styles.creditCtaArrow}>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>TVOJI OGLASI</Text>
            <Text style={styles.sectionTitle}>Kampanje</Text>
          </View>
          <TouchableOpacity style={styles.compactAddButton} onPress={() => navigation.navigate('CreateJob')}>
            <Ionicons name="add-circle-outline" size={18} color="#DCD7FF" />
            <Text style={styles.compactAddText}>Novi oglas</Text>
          </TouchableOpacity>
        </View>

        {jobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="briefcase-outline" size={30} color="#fff" />
            </View>
            <Text style={styles.emptyTitle}>Još nema oglasa</Text>
            <Text style={styles.emptyText}>Dodaj prvi oglas, izaberi trajanje i kreni da skupljaš kandidate.</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('CreateJob')}>
              <Text style={styles.emptyButtonText}>Dodaj oglas</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          jobs.map((item) => {
            const status = getStatusMeta(item);
            const topSkills = (item.skills_required || []).slice(0, 3);
            const extraSkills = Math.max((item.skills_required?.length || 0) - topSkills.length, 0);
            const boosted = isBoosted(item);

            return (
              <View key={item.id} style={[styles.jobCard, boosted && styles.boostedJobCard]}>
                <View style={styles.jobTopRow}>
                  <View style={styles.topPillsLeft}>
                    <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                      <Ionicons name={status.icon} size={15} color={status.color} />
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                    {boosted && (
                      <View style={styles.boostPill}>
                        <Ionicons name="flame" size={14} color="#FFD08A" />
                        <Text style={styles.boostPillText}>Boost</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.daysPill}>
                    <Ionicons name="calendar-outline" size={14} color="#BFC7FF" />
                    <Text style={styles.daysPillText}>{formatDaysLeft(item.expires_at)}</Text>
                  </View>
                </View>

                <Text style={styles.jobTitle}>{item.title}</Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaChip}>
                    <Ionicons name="location-outline" size={15} color="#FF4BA0" />
                    <Text style={styles.metaText}>{item.location || 'Lokacija nije navedena'}</Text>
                  </View>
                  {!!item.job_type && (
                    <View style={styles.metaChip}>
                      <Ionicons name="time-outline" size={15} color="#36D1DC" />
                      <Text style={styles.metaText}>{item.job_type}</Text>
                    </View>
                  )}
                </View>

                {!!item.description && <Text style={styles.description} numberOfLines={3}>{item.description}</Text>}

                <View style={styles.skillRow}>
                  {topSkills.map((skill) => (
                    <View key={skill} style={styles.skillChip}>
                      <Text style={styles.skillText}>{skill}</Text>
                    </View>
                  ))}
                  {extraSkills > 0 && (
                    <View style={styles.skillChipMuted}>
                      <Text style={styles.skillMutedText}>+{extraSkills}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.timelineCard}>
                  <View style={styles.timelineItem}>
                    <Text style={styles.timelineLabel}>Aktivan do</Text>
                    <Text style={styles.timelineValue}>{formatExpiry(item.expires_at)}</Text>
                  </View>
                  <View style={styles.timelineDivider} />
                  <View style={styles.timelineItem}>
                    <Text style={styles.timelineLabel}>Potrošeno</Text>
                    <Text style={styles.timelineValue}>{item.credits_spent || 0} kredita</Text>
                  </View>
                  <View style={styles.timelineDivider} />
                  <View style={styles.timelineItem}>
                    <Text style={styles.timelineLabel}>Boost</Text>
                    <Text style={styles.timelineValue}>{formatBoost(item.boost_until)}</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.dashboardButton} onPress={() => navigation.navigate('JobDashboard', { job: item })}>
                  <View style={styles.dashboardIcon}>
                    <Ionicons name="analytics-outline" size={18} color="#fff" />
                  </View>
                  <Text style={styles.dashboardButtonText}>Kandidati i analitika</Text>
                  <Ionicons name="chevron-forward" size={19} color="#AEB8FF" />
                </TouchableOpacity>

                <View style={styles.actionGrid}>
                  <TouchableOpacity style={styles.primaryAction} onPress={() => handleActivatePress(item)}>
                    <Ionicons name={item.is_active ? 'add-circle-outline' : 'play-outline'} size={17} color="#fff" />
                    <Text style={styles.primaryActionText}>{getPrimaryActionLabel(item)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.boostAction, boostBusyJobId === item.id && styles.disabledAction]}
                    disabled={boostBusyJobId === item.id}
                    onPress={() => handleBoostPress(item)}
                  >
                    {boostBusyJobId === item.id ? (
                      <ActivityIndicator color="#231506" size="small" />
                    ) : (
                      <Ionicons name="flame-outline" size={17} color="#231506" />
                    )}
                    <Text style={styles.boostActionText}>{boosted ? 'Produži boost' : 'Boost 24h'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.actionGrid}>
                  <TouchableOpacity style={styles.secondaryAction} onPress={() => updateJobStatus(item.id, 'paused')}>
                    <Ionicons name="pause-outline" size={17} color="#DDE3FF" />
                    <Text style={styles.secondaryActionText}>Pauziraj</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('CreateJob', { job: item })}>
                    <Ionicons name="create-outline" size={17} color="#DDE3FF" />
                    <Text style={styles.secondaryActionText}>Izmeni</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.actionGrid}>
                  <TouchableOpacity style={styles.secondaryAction} onPress={() => handleResetPress(item)}>
                    <Ionicons name="refresh-outline" size={17} color="#DDE3FF" />
                    <Text style={styles.secondaryActionText}>Reset odluka</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.deleteAction} onPress={() => deleteJob(item)}>
                    <Ionicons name="trash-outline" size={17} color="#FF9CA3" />
                    <Text style={styles.deleteActionText}>Obriši</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal transparent animationType="fade" visible={!!creditModalJob} onRequestClose={() => setCreditModalJob(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.creditModal}>
            <LinearGradient colors={['rgba(124,92,255,0.25)', 'rgba(54,209,220,0.08)']} style={styles.modalGlow} />
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="diamond-outline" size={24} color="#fff" />
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setCreditModalJob(null)}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalKicker}>AKTIVACIJA OGLASA</Text>
            <Text style={styles.modalTitle}>{creditModalJob?.title || 'Oglas'}</Text>
            <Text style={styles.modalCopy}>
              Izaberi koliko dugo oglas ostaje aktivan. Ako ga produžavaš dok je aktivan, novi dani se dodaju na postojeći period.
            </Text>

            <View style={styles.modalBalance}>
              <Ionicons name="wallet-outline" size={17} color="#86EFAC" />
              <Text style={styles.modalBalanceText}>Dostupno: {creditBalance} kredita</Text>
            </View>

            {CREDIT_DURATION_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.credits}
                style={styles.durationOption}
                disabled={creditBusy}
                onPress={() => activateWithCredits(option.credits)}
              >
                <View style={styles.durationIcon}>
                  <Text style={styles.durationIconText}>{option.credits}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.durationTitle}>{option.label}</Text>
                  <Text style={styles.durationDescription}>{option.description}</Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color="#C4B5FD" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={!!confirmAction} onRequestClose={() => !confirmBusy && setConfirmAction(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={[styles.confirmIcon, confirmAction?.type === 'delete' ? styles.confirmIconDanger : styles.confirmIconBoost]}>
              <Ionicons
                name={confirmAction?.type === 'delete' ? 'trash-outline' : confirmAction?.type === 'reset' ? 'refresh-outline' : 'flame-outline'}
                size={26}
                color={confirmAction?.type === 'delete' ? '#FF9CA3' : confirmAction?.type === 'reset' ? '#DCD7FF' : '#FFD08A'}
              />
            </View>

            <Text style={styles.confirmTitle}>
              {confirmAction?.type === 'delete'
                ? 'Obriši oglas?'
                : confirmAction?.type === 'reset'
                  ? 'Resetuj odluke za oglas?'
                : confirmAction?.job && isBoosted(confirmAction.job)
                  ? 'Produži boost?'
                  : 'Boostuj oglas?'}
            </Text>
            <Text style={styles.confirmText}>
              {confirmAction?.type === 'delete'
                ? `Oglas "${confirmAction?.job.title}" biće trajno obrisan. Ovu akciju ne možemo da vratimo.`
                : confirmAction?.type === 'reset'
                  ? `Obrisaće se samo tvoje odluke starije od 30 dana za oglas "${confirmAction?.job.title}". Ti kandidati mogu opet da se pojave za ovaj oglas.`
                : `Boost košta 1 kredit i gura oglas "${confirmAction?.job.title}" ispred običnih oglasa kandidatima naredna 24h.`}
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                disabled={confirmBusy}
                onPress={() => setConfirmAction(null)}
              >
                <Text style={styles.confirmCancelText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  confirmAction?.type === 'delete'
                    ? styles.confirmDangerButton
                    : confirmAction?.type === 'reset'
                      ? styles.confirmResetButton
                      : styles.confirmBoostButton,
                  confirmBusy && styles.disabledAction,
                ]}
                disabled={confirmBusy}
                onPress={runConfirmAction}
              >
                {confirmBusy ? (
                  <ActivityIndicator color={confirmAction?.type === 'boost' ? '#231506' : '#fff'} />
                ) : (
                  <Text
                    style={
                      confirmAction?.type === 'delete'
                        ? styles.confirmDangerText
                        : confirmAction?.type === 'reset'
                          ? styles.confirmResetText
                          : styles.confirmBoostText
                    }
                  >
                    {confirmAction?.type === 'delete' ? 'Obriši' : confirmAction?.type === 'reset' ? 'Resetuj' : 'Boost 24h'}
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
  center: { flex: 1, backgroundColor: '#050711', justifyContent: 'center', alignItems: 'center' },
  orbTop: {
    position: 'absolute',
    top: -130,
    right: -130,
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: 'rgba(124,92,255,0.24)',
  },
  orbBottom: {
    position: 'absolute',
    bottom: 80,
    left: -160,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(54,209,220,0.12)',
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 18,
    paddingTop: 28,
    paddingBottom: 118,
    gap: 18,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  headerCopy: { flex: 1 },
  kicker: { color: '#93A4FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: -1.1, marginTop: 4 },
  subtitle: { color: '#A9B3D5', marginTop: 6, fontSize: 15, lineHeight: 22, maxWidth: 360 },
  newJobButton: { borderRadius: 22, overflow: 'hidden', ...glowShadow },
  newJobGradient: { width: 58, height: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  commandCard: {
    padding: 18,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(199,210,254,0.18)',
    gap: 16,
    overflow: 'hidden',
    ...glowShadow,
  },
  commandTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  commandIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  commandTextWrap: { flex: 1 },
  commandLabel: { color: '#BFC7E8', fontSize: 12, fontWeight: '800' },
  commandTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 2 },
  creditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
  },
  creditPillText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  statGrid: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    minHeight: 84,
    padding: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(6,8,18,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 7 },
  statLabel: { color: '#A7B0D2', fontSize: 11, fontWeight: '800', marginTop: 2 },
  creditCta: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 23,
    backgroundColor: 'rgba(5,7,17,0.46)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  creditCtaTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  creditCtaText: { color: '#B9C2DE', fontSize: 12, lineHeight: 18, marginTop: 2 },
  creditCtaArrow: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C5CFF' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 2 },
  sectionKicker: { color: '#8F9BFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 3 },
  compactAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  compactAddText: { color: '#DCD7FF', fontSize: 12, fontWeight: '900' },
  emptyCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 32,
    backgroundColor: 'rgba(16,20,33,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(169,179,255,0.16)',
    gap: 12,
  },
  emptyIcon: { width: 70, height: 70, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C5CFF' },
  emptyTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 4 },
  emptyText: { color: '#B8C0DD', lineHeight: 22, textAlign: 'center' },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingHorizontal: 18, minHeight: 52, borderRadius: 18, backgroundColor: '#7C5CFF' },
  emptyButtonText: { color: '#fff', fontWeight: '900' },
  jobCard: {
    padding: 16,
    borderRadius: 32,
    backgroundColor: 'rgba(16,20,33,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(169,179,255,0.18)',
    gap: 14,
    overflow: 'hidden',
    ...glowShadow,
  },
  boostedJobCard: {
    borderColor: 'rgba(255,184,107,0.46)',
    backgroundColor: 'rgba(24,21,30,0.98)',
  },
  jobTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  topPillsLeft: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  statusText: { fontSize: 12, fontWeight: '900' },
  boostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,184,107,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,107,0.36)',
  },
  boostPillText: { color: '#FFD08A', fontSize: 12, fontWeight: '900' },
  daysPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  daysPillText: { color: '#DDE3FF', fontSize: 12, fontWeight: '900' },
  jobTitle: { color: '#fff', fontSize: 27, fontWeight: '900', letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  metaText: { color: '#D5DBF0', fontSize: 13, fontWeight: '800', flexShrink: 1 },
  description: { color: '#AEB8D3', fontSize: 14, lineHeight: 21 },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(124,92,255,0.22)', borderWidth: 1, borderColor: 'rgba(196,181,253,0.35)' },
  skillText: { color: '#F0ECFF', fontSize: 12, fontWeight: '900' },
  skillChipMuted: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  skillMutedText: { color: '#AEB8D3', fontSize: 12, fontWeight: '900' },
  timelineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(5,7,17,0.50)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  timelineItem: { flex: 1 },
  timelineLabel: { color: '#7F8BAE', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  timelineValue: { color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 4 },
  timelineDivider: { width: 1, height: 42, backgroundColor: 'rgba(255,255,255,0.10)', marginHorizontal: 12 },
  dashboardButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(124,92,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.30)',
  },
  dashboardIcon: { width: 34, height: 34, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C5CFF' },
  dashboardButtonText: { color: '#DCE3FF', fontWeight: '900', flex: 1 },
  actionGrid: { flexDirection: 'row', gap: 10 },
  primaryAction: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 17,
    backgroundColor: '#7C5CFF',
  },
  primaryActionText: { color: '#fff', fontWeight: '900' },
  boostAction: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 17,
    backgroundColor: '#FFB86B',
  },
  boostActionText: { color: '#231506', fontWeight: '900' },
  disabledAction: { opacity: 0.72 },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  secondaryActionText: { color: '#DDE3FF', fontWeight: '900' },
  deleteAction: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 17,
    backgroundColor: 'rgba(255,75,100,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(255,156,163,0.18)',
  },
  deleteActionText: { color: '#FF9CA3', fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)', justifyContent: 'center', padding: 20 },
  creditModal: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    padding: 18,
    borderRadius: 32,
    backgroundColor: '#101421',
    borderWidth: 1,
    borderColor: '#313A6A',
    gap: 14,
    overflow: 'hidden',
    ...glowShadow,
  },
  modalGlow: { ...StyleSheet.absoluteFillObject },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C5CFF' },
  modalClose: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  modalKicker: { color: '#A9B3FF', fontSize: 11, fontWeight: '900', letterSpacing: 0.9, marginTop: 2 },
  modalTitle: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.4 },
  modalCopy: { color: '#CAD2EA', lineHeight: 21 },
  modalBalance: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.28)',
  },
  modalBalanceText: { color: '#86EFAC', fontWeight: '900' },
  durationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(23,28,51,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(169,179,255,0.18)',
  },
  durationIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.25)' },
  durationIconText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  durationTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  durationDescription: { color: '#AAB3D2', marginTop: 4, lineHeight: 18 },
  confirmModal: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 30,
    backgroundColor: '#101421',
    borderWidth: 1,
    borderColor: '#313A6A',
    gap: 13,
    ...glowShadow,
  },
  confirmIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  confirmIconBoost: { backgroundColor: 'rgba(255,184,107,0.13)', borderColor: 'rgba(255,184,107,0.34)' },
  confirmIconDanger: { backgroundColor: 'rgba(255,75,100,0.11)', borderColor: 'rgba(255,156,163,0.24)' },
  confirmTitle: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
  confirmText: { color: '#CAD2EA', fontSize: 14, lineHeight: 21 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  confirmCancelButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  confirmCancelText: { color: '#DDE3FF', fontWeight: '900' },
  confirmBoostButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFB86B',
  },
  confirmBoostText: { color: '#231506', fontWeight: '900' },
  confirmResetButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C5CFF',
  },
  confirmResetText: { color: '#fff', fontWeight: '900' },
  confirmDangerButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4B64',
  },
  confirmDangerText: { color: '#fff', fontWeight: '900' },
});
