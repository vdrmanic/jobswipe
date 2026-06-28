export type SkillCategory = {
  key: string;
  label: string;
  skills: string[];
};

export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    key: 'it',
    label: 'IT & razvoj',
    skills: ['JavaScript', 'TypeScript', 'React', 'React Native', 'Node.js', 'Python', 'AWS', 'SQL', 'DevOps'],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    skills: ['SEO', 'Google Ads', 'Facebook Ads', 'Copywriting', 'Content marketing', 'Email marketing', 'Analitika'],
  },
  {
    key: 'sales',
    label: 'Prodaja',
    skills: ['B2B prodaja', 'Cold calling', 'CRM', 'Pregovaranje', 'Lead generation', 'Prezentacije'],
  },
  {
    key: 'services',
    label: 'Usluge',
    skills: ['Rad s ljudima', 'Sluzenje pica', 'Organizacija', 'Hotelski servis', 'Kuhinja', 'Recepcija'],
  },
  {
    key: 'other',
    label: 'Ostalo',
    skills: ['Komunikacija', 'Timwork', 'Vodjenje projekata', 'Administracija', 'Logistika'],
  },
];

export const ALL_SKILLS = SKILL_CATEGORIES.flatMap((category) => category.skills);
