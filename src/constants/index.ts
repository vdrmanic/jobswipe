export * from './colors';
export * from './routes';
export * from './sizes';
export * from './swipes';

export const TAB_BAR_HEIGHT = 64;
export const SWIPE_THRESHOLD = 120;
export const SWIPE_DURATION = 220;
export const FETCH_INTERVAL = 2000;

export const ERROR_MESSAGES = {
  NETWORK: 'Greška u konekciji. Proverite internet konekciju.',
  AUTH_FAILED: 'Autentifikacija neuspešna. Pokušajte ponovo.',
  NOT_FOUND: 'Podatak nije pronađen.',
  PERMISSION_DENIED: 'Nemate dozvolu za ovu akciju.',
  INVALID_INPUT: 'Uneseni podaci nisu validni.',
  SERVER_ERROR: 'Greška servera. Pokušajte ponovo kasnije.',
  UNKNOWN: 'Nepoznata greška. Pokušajte ponovo.',
} as const;

export const SUCCESS_MESSAGES = {
  PROFILE_UPDATED: 'Profil uspešno ažuriran.',
  JOB_CREATED: 'Oglas uspešno kreiran.',
  MESSAGE_SENT: 'Poruka uspešno poslata.',
  LOGGED_OUT: 'Uspešno ste se odjavili.',
} as const;

export const USER_TYPES = {
  CANDIDATE: 'candidate',
  COMPANY: 'company',
} as const;

export const EXPERIENCE_LEVELS = {
  JUNIOR: 'junior',
  MID: 'mid',
  SENIOR: 'senior',
} as const;

export const JOB_TYPES = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  REMOTE: 'Remote',
} as const;

export const SWIPE_DIRECTIONS = {
  LEFT: 'left',
  RIGHT: 'right',
  SUPER: 'super',
} as const;
