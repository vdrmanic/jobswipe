export type UserType = 'candidate' | 'company';

export interface Profile {
  id: string;
  user_type: UserType;
  full_name: string;
  avatar_url: string | null;
  location: string | null;
  bio: string | null;
  daily_match_digest_enabled?: boolean | null;
  created_at: string;
}

export interface ProfileVideo {
  id: string;
  user_id: string;
  s3_key: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  duration_ms: number | null;
  status: 'ready' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface ExperienceItem {
  company?: string;
  position: string;
  duration: string;
  description?: string;
}

export type ExperienceVerificationStatus =
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'changes_requested';

export interface ExperienceVerification {
  id: string;
  candidate_id: string;
  experience_index: number;
  company_name: string;
  position: string;
  duration: string;
  description: string;
  document_path: string;
  document_name: string;
  document_mime_type: string;
  status: ExperienceVerificationStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Pick<Profile, 'full_name' | 'avatar_url'>;
}

export interface CandidateProfile {
  id: string;
  position: string | null;
  experience_level: 'junior' | 'mid' | 'senior' | null;
  skills: string[] | null;
  job_type: string[] | null;
  cv_url: string | null;
  experience_items: ExperienceItem[] | null;
}

export interface CompanyProfile {
  id: string;
  company_name: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  logo_url: string | null;
}

export interface JobListing {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  location: string | null;
  job_type: string | null;
  skills_required: string[] | null;
  salary_range: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  work_mode?: string | null;
  seniority?: string | null;
  schedule?: string | null;
  benefits?: string[] | null;
  is_draft?: boolean;
  published_at?: string | null;
  expires_at?: string | null;
  credits_spent?: number | null;
  boost_until?: string | null;
  boost_credits_spent?: number | null;
  is_active: boolean;
  status?: 'active' | 'paused' | 'filled' | 'expired' | string | null;
  created_at: string;
  company_profiles?: CompanyProfile;
  profiles?: Profile;
}

export interface CompanyCreditWallet {
  company_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyCreditTransaction {
  id: string;
  company_id: string;
  job_id: string | null;
  amount: number;
  balance_after: number;
  type: 'test_purchase' | 'purchase' | 'spend' | 'refund' | 'admin_adjustment';
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Match {
  id: string;
  candidate_id: string;
  company_id: string;
  job_id: string;
  pipeline_stage?: PipelineStage;
  interview_at?: string | null;
  interview_location?: string | null;
  interview_note?: string | null;
  pipeline_updated_at?: string;
  created_at: string;
}

export type PipelineStage = 'new' | 'contacted' | 'interview' | 'offer' | 'rejected';

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface SwipeAction {
  swiper_id: string;
  target_id: string;
  target_type: 'job' | 'candidate';
  direction: 'left' | 'right' | 'super';
  job_id: string;
  decided_at?: string;
}

export type DiscoveryMode = 'candidate' | 'company';

export interface DiscoveryFilters {
  position: string;
  location: string;
  jobTypes: string[];
  skills: string[];
  experienceLevels: string[];
  verifiedOnly: boolean;
  minimumScore: number;
}

export interface MatchScore {
  score: number;
  reasons: string[];
  matchedSkills: string[];
  missingSkills?: string[];
}

export type AppNotificationType = 'match' | 'message' | 'verification' | 'system';

export interface AppNotification {
  id: string;
  user_id: string;
  type: AppNotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned';

export interface UserReport {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  match_id: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  reporter?: Pick<Profile, 'full_name'>;
  reported_user?: Pick<Profile, 'full_name' | 'user_type'>;
}
