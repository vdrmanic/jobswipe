import { CandidateProfile, DiscoveryFilters, JobListing, MatchScore, Profile } from '../types';

const normalize = (value?: string | null) =>
  (value || '')
    .toLocaleLowerCase('sr-Latn')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'dj')
    .trim();

const words = (value?: string | null) =>
  normalize(value).split(/[^a-z0-9]+/).filter((word) => word.length > 2);

const textMatches = (left?: string | null, right?: string | null) => {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const rightWords = new Set(words(right));
  return words(left).some((word) => rightWords.has(word));
};

const overlap = (left: string[] = [], right: string[] = []) => {
  const rightSet = new Set(right.map(normalize));
  return left.filter((item) => rightSet.has(normalize(item)));
};

const durationToLevel = (items: CandidateProfile['experience_items']) => {
  const durations = (items || []).map((item) => normalize(item.duration)).join(' ');
  if (/5\+|5 godina|3-5|senior/.test(durations)) return 'senior';
  if (/2-3|3 godine|1-2|mid/.test(durations) || (items || []).length >= 2) return 'mid';
  return 'junior';
};

export const defaultDiscoveryFilters: DiscoveryFilters = {
  position: '',
  location: '',
  jobTypes: [],
  skills: [],
  experienceLevels: [],
  verifiedOnly: false,
  minimumScore: 0,
};

export const scoreJobForCandidate = (
  job: JobListing,
  candidate: Pick<CandidateProfile, 'position' | 'skills' | 'job_type'>,
  candidateLocation?: string | null
): MatchScore => {
  let score = 0;
  const reasons: string[] = [];
  const matchedSkills = overlap(candidate.skills || [], job.skills_required || []);

  if (textMatches(candidate.position, job.title)) {
    score += 40;
    reasons.push('Pozicija odgovara onome sto trazis');
  }

  if ((job.skills_required || []).length) {
    const skillRatio = matchedSkills.length / Math.max(job.skills_required?.length || 1, 1);
    score += Math.round(skillRatio * 35);
    if (matchedSkills.length) reasons.push(`${matchedSkills.length} trazenih vestina se poklapa`);
  } else {
    score += 18;
  }

  if (textMatches(candidateLocation, job.location) || /remote|od kuce/.test(normalize(job.location))) {
    score += 15;
    reasons.push('Lokacija odgovara');
  }

  if (overlap(candidate.job_type || [], job.job_type ? [job.job_type] : []).length) {
    score += 10;
    reasons.push('Tip posla odgovara');
  }

  return { score: Math.min(score, 100), reasons: reasons.slice(0, 3), matchedSkills };
};

export const scoreCandidateForJob = (
  candidate: CandidateProfile,
  profile: Pick<Profile, 'location'>,
  job: JobListing,
  hasVerifiedExperience: boolean
): MatchScore => {
  const base = scoreJobForCandidate(job, candidate, profile.location);
  const reasons = [...base.reasons];
  let score = base.score;

  if (hasVerifiedExperience) {
    score = Math.min(score + 10, 100);
    reasons.push('Ima verifikovano iskustvo');
  }

  return { ...base, score, reasons: reasons.slice(0, 3) };
};

export const candidatePassesFilters = (
  candidate: CandidateProfile,
  profile: Pick<Profile, 'location'>,
  filters: DiscoveryFilters,
  hasVerifiedExperience: boolean,
  score: number
) =>
  (!filters.position || textMatches(candidate.position, filters.position)) &&
  (!filters.location || textMatches(profile.location, filters.location)) &&
  (!filters.skills.length || overlap(candidate.skills || [], filters.skills).length === filters.skills.length) &&
  (!filters.experienceLevels.length || filters.experienceLevels.includes(candidate.experience_level || durationToLevel(candidate.experience_items))) &&
  (!filters.verifiedOnly || hasVerifiedExperience) &&
  score >= filters.minimumScore;

export const jobPassesFilters = (job: JobListing, filters: DiscoveryFilters, score: number) =>
  (!filters.position || textMatches(job.title, filters.position)) &&
  (!filters.location || textMatches(job.location, filters.location)) &&
  (!filters.jobTypes.length || filters.jobTypes.some((type) => textMatches(job.job_type, type))) &&
  (!filters.skills.length || overlap(job.skills_required || [], filters.skills).length === filters.skills.length) &&
  score >= filters.minimumScore;

