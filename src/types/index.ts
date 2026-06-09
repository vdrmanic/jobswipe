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
  position: string;
  duration: string;
  description?: string;
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