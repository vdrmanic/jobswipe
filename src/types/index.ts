export type UserType = 'candidate' | 'company';

export interface Profile {
  id: string;
  user_type: UserType;
  full_name: string;
  avatar_url: string | null;
  location: string | null;
  bio: string | null;
  created_at: string;
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
  is_active: boolean;
  created_at: string;
  company_profiles?: CompanyProfile;
  profiles?: Profile;
}

export interface Match {
  id: string;
  candidate_id: string;
  company_id: string;
  job_id: string;
  created_at: string;
}

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
}
