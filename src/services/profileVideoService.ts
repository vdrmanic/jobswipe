import { supabase } from '../lib/supabase';
import { ProfileVideo } from '../types';

const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export const profileVideoService = {
  maxVideoSize: MAX_VIDEO_SIZE,
  allowedVideoTypes: ALLOWED_VIDEO_TYPES,

  async fetchProfileVideos(userId: string) {
    const { data, error } = await supabase
      .from('profile_videos')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ProfileVideo[];
  },

  async createUpload(input: { fileName: string; mimeType: string; fileSize: number }) {
    const { data, error } = await supabase.functions.invoke('create-profile-video-upload', {
      body: input,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { uploadUrl: string; key: string; fileName: string; mimeType: string; maxFileSize: number };
  },

  async saveMetadata(input: {
    userId: string;
    s3Key: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    durationMs?: number | null;
  }) {
    const { data, error } = await supabase
      .from('profile_videos')
      .insert({
        user_id: input.userId,
        s3_key: input.s3Key,
        file_name: input.fileName,
        mime_type: input.mimeType,
        file_size: input.fileSize,
        duration_ms: input.durationMs || null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as ProfileVideo;
  },

  async getPlaybackUrl(videoId: string) {
    const { data, error } = await supabase.functions.invoke('get-profile-video-url', {
      body: { videoId },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.url as string;
  },

  async deleteVideo(videoId: string) {
    const { data, error } = await supabase.functions.invoke('delete-profile-video', {
      body: { videoId },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },
};
