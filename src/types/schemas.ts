// Note: Install zod with: npm install zod
// import { z } from 'zod';

// UNCOMMENT WHEN ZOD IS INSTALLED

// export const ProfileSchema = z.object({
//   id: z.string(),
//   user_type: z.enum(['candidate', 'company']),
//   full_name: z.string().min(2),
//   avatar_url: z.string().url().nullable(),
//   location: z.string().nullable(),
//   bio: z.string().nullable(),
//   created_at: z.string(),
// });

// export const CandidateProfileSchema = z.object({
//   id: z.string(),
//   position: z.string().nullable(),
//   experience_level: z.enum(['junior', 'mid', 'senior']).nullable(),
//   skills: z.array(z.string()).nullable(),
//   job_type: z.array(z.string()).nullable(),
//   cv_url: z.string().url().nullable(),
//   experience_items: z.array(z.object({
//     position: z.string(),
//     duration: z.string(),
//     description: z.string().optional(),
//   })).nullable(),
// });

// export const CompanyProfileSchema = z.object({
//   id: z.string(),
//   company_name: z.string().nullable(),
//   industry: z.string().nullable(),
//   company_size: z.string().nullable(),
//   website: z.string().url().nullable(),
//   logo_url: z.string().url().nullable(),
// });

// export const JobListingSchema = z.object({
//   id: z.string(),
//   company_id: z.string(),
//   title: z.string().min(3),
//   description: z.string().nullable(),
//   location: z.string().nullable(),
//   job_type: z.string().nullable(),
//   skills_required: z.array(z.string()).nullable(),
//   salary_range: z.string().nullable(),
//   is_active: z.boolean(),
//   created_at: z.string(),
// });

// export const MessageSchema = z.object({
//   id: z.string(),
//   match_id: z.string(),
//   sender_id: z.string(),
//   content: z.string().min(1),
//   read: z.boolean(),
//   created_at: z.string(),
// });

// export const MatchSchema = z.object({
//   id: z.string(),
//   candidate_id: z.string(),
//   company_id: z.string(),
//   job_id: z.string(),
//   created_at: z.string(),
// });

// export type Profile = z.infer<typeof ProfileSchema>;
// export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;
// export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;
// export type JobListing = z.infer<typeof JobListingSchema>;
// export type Message = z.infer<typeof MessageSchema>;
// export type Match = z.infer<typeof MatchSchema>;
