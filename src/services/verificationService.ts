import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';
import { File as ExpoFile } from 'expo-file-system';
import {
  ExperienceItem,
  ExperienceVerification,
  ExperienceVerificationStatus,
} from '../types';

const BUCKET = 'experience-verification-documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

type VerificationDocument = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  file?: { arrayBuffer(): Promise<ArrayBuffer> } | null;
};

type SubmitProgress = 'reading' | 'uploading' | 'saving';

const withTimeout = async <T>(promise: Promise<T>, message: string, timeoutMs = 30000) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const readDocument = async (document: VerificationDocument) => {
  if (Platform.OS === 'web' && document.file) {
    return document.file.arrayBuffer();
  }

  return new ExpoFile(document.uri).arrayBuffer();
};

const normalizeMimeType = (document: VerificationDocument) => {
  if (document.mimeType && ALLOWED_MIME_TYPES.includes(document.mimeType)) {
    return document.mimeType;
  }

  const extension = document.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
};

const safeFileName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(-100);

const normalize = (value?: string | null) => value?.trim() || '';

export const findExperienceVerification = (
  verifications: ExperienceVerification[],
  experience: ExperienceItem,
  experienceIndex: number
) =>
  verifications.find(
    (verification) =>
      verification.experience_index === experienceIndex &&
      normalize(verification.company_name) === normalize(experience.company) &&
      normalize(verification.position) === normalize(experience.position) &&
      normalize(verification.duration) === normalize(experience.duration) &&
      normalize(verification.description) === normalize(experience.description)
  );

export const verificationService = {
  async isAdmin(userId: string) {
    const { data, error } = await supabase
      .from('verification_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return false;
    return Boolean(data);
  },

  async fetchCandidateVerifications(candidateId: string) {
    const { data, error } = await supabase
      .from('experience_verifications')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ExperienceVerification[];
  },

  async fetchPublicVerifiedExperiences(candidateIds: string[]) {
    if (candidateIds.length === 0) return [] as ExperienceVerification[];

    const { data, error } = await supabase
      .from('verified_experience_badges')
      .select('*')
      .in('candidate_id', candidateIds);

    if (error) throw error;
    return (data || []) as ExperienceVerification[];
  },

  async submitVerification(
    candidateId: string,
    experienceIndex: number,
    experience: ExperienceItem,
    document: VerificationDocument,
    onProgress?: (progress: SubmitProgress) => void
  ) {
    if (document.size && document.size > MAX_FILE_SIZE) {
      throw new Error('Dokument ne sme biti veci od 10 MB.');
    }

    const mimeType = normalizeMimeType(document);
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error('Dozvoljeni su PDF, JPG, PNG i WEBP dokumenti.');
    }

    onProgress?.('reading');
    const fileData = await withTimeout(
      readDocument(document),
      'Citanje dokumenta traje predugo. Izaberi fajl ponovo.'
    );
    if (fileData.byteLength > MAX_FILE_SIZE) {
      throw new Error('Dokument ne sme biti veci od 10 MB.');
    }

    const path = `${candidateId}/${Date.now()}-${safeFileName(document.name)}`;
    onProgress?.('uploading');
    const { error: uploadError } = await withTimeout(
      supabase.storage.from(BUCKET).upload(path, fileData, {
        contentType: mimeType,
        upsert: false,
      }),
      'Slanje dokumenta traje predugo. Proveri internet i pokusaj ponovo.'
    );

    if (uploadError) throw uploadError;

    onProgress?.('saving');
    const { data, error } = await withTimeout(
      Promise.resolve(supabase
        .from('experience_verifications')
        .insert({
          candidate_id: candidateId,
          experience_index: experienceIndex,
          company_name: experience.company?.trim() || '',
          position: experience.position.trim(),
          duration: experience.duration.trim(),
          description: experience.description?.trim() || '',
          document_path: path,
          document_name: document.name,
          document_mime_type: mimeType,
        })
        .select('*')
        .single()),
      'Cuvanje zahteva traje predugo. Pokusaj ponovo.'
    );

    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw error;
    }

    return data as ExperienceVerification;
  },

  async fetchReviewQueue(status: ExperienceVerificationStatus | 'all' = 'pending') {
    let query = supabase
      .from('experience_verifications')
      .select('*')
      .order('created_at', { ascending: true });

    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as ExperienceVerification[];
    const candidateIds = [...new Set(rows.map((row) => row.candidate_id))];
    if (candidateIds.length === 0) return rows;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', candidateIds);

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    return rows.map((row) => ({ ...row, profiles: profileMap.get(row.candidate_id) }));
  },

  async createDocumentUrl(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
  },

  async review(
    verificationId: string,
    status: Exclude<ExperienceVerificationStatus, 'pending'>,
    reviewNote?: string
  ) {
    const { error } = await supabase
      .from('experience_verifications')
      .update({ status, review_note: reviewNote?.trim() || null })
      .eq('id', verificationId);

    if (error) throw error;
  },
};
