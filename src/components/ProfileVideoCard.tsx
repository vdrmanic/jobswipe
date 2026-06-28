import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { COLORS } from '../constants';
import { profileVideoService } from '../services/profileVideoService';
import { ProfileVideo } from '../types';

type Props = {
  video: ProfileVideo;
  canDelete?: boolean;
  onDelete?: (videoId: string) => void;
};

const formatSize = (bytes: number) => {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
};

export default function ProfileVideoCard({ video, canDelete = false, onDelete }: Props) {
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const player = useVideoPlayer(playbackUrl ? { uri: playbackUrl } : null, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    profileVideoService
      .getPlaybackUrl(video.id)
      .then((url) => {
        if (mounted) setPlaybackUrl(url);
      })
      .catch((err) => {
        if (mounted) setError(err?.message || 'Video nije dostupan.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [video.id]);

  const confirmDelete = () => {
    Alert.alert(
      'Obriši video',
      'Video će biti uklonjen sa profila. Ovu radnju ne možeš da vratiš.',
      [
        { text: 'Odustani', style: 'cancel' },
        { text: 'Obriši', style: 'destructive', onPress: () => onDelete?.(video.id) },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="videocam" size={20} color={COLORS.primarySoft} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>Video predstavljanje</Text>
          <Text style={styles.meta} numberOfLines={1}>{video.file_name} {formatSize(video.file_size)}</Text>
        </View>
        {canDelete && (
          <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete}>
            <Ionicons name="trash-outline" size={18} color={COLORS.secondary} />
            <Text style={styles.deleteText}>Obriši</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.videoWrap}>
        {loading ? (
          <ActivityIndicator color={COLORS.primarySoft} />
        ) : error || !playbackUrl ? (
          <Text style={styles.errorText}>{error || 'Video nije dostupan.'}</Text>
        ) : (
          <VideoView
            style={styles.video}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
            contentFit="contain"
            nativeControls
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 13, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.glass },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconBox: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.16)' },
  copy: { flex: 1, minWidth: 0 },
  title: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
  meta: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, height: 38, borderRadius: 13, backgroundColor: COLORS.dangerBg },
  deleteText: { color: COLORS.secondary, fontSize: 11, fontWeight: '900' },
  videoWrap: { height: 280, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#05060a', borderWidth: 1, borderColor: COLORS.border },
  video: { width: '100%', height: '100%' },
  errorText: { color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 },
});
