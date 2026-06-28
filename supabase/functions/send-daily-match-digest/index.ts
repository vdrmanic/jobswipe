import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-digest-secret',
};

type DigestRequest = {
  digest_date?: string;
  timezone?: string;
};

type MatchRow = {
  id: string;
  candidate_id: string;
  company_id: string;
  job_id: string;
  created_at: string;
  job_listings: {
    title: string | null;
    location: string | null;
  } | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  daily_match_digest_enabled: boolean | null;
};

type CompanyProfileRow = {
  id: string;
  company_name: string | null;
};

const json = (payload: unknown, status = 200) =>
  Response.json(payload, { status, headers: corsHeaders });

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const formatDateInZone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return asUtc - date.getTime();
};

const zonedDateRange = (digestDate: string, timeZone: string) => {
  const [year, month, day] = digestDate.split('-').map(Number);
  const startEstimate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const start = new Date(startEstimate.getTime() - getTimeZoneOffsetMs(startEstimate, timeZone));
  const endEstimate = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  const end = new Date(endEstimate.getTime() - getTimeZoneOffsetMs(endEstimate, timeZone));
  return { start, end };
};

const sendEmail = async (payload: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(await response.text());
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const configuredSecret = Deno.env.get('DIGEST_CRON_SECRET');
  const providedSecret = request.headers.get('x-digest-secret');
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const fromEmail = Deno.env.get('MATCH_EMAIL_FROM') || Deno.env.get('RESEND_FROM_EMAIL');
  const appUrl = Deno.env.get('APP_PUBLIC_URL') || 'https://jobhop.net';
  if (!url || !serviceKey) return json({ error: 'Missing Supabase configuration' }, 500);
  if (!Deno.env.get('RESEND_API_KEY') || !fromEmail) return json({ error: 'Email provider is not configured' }, 500);

  const body = (await request.json().catch(() => ({}))) as DigestRequest;
  const timeZone = body.timezone || 'Europe/Belgrade';
  const digestDate = body.digest_date || formatDateInZone(new Date(), timeZone);
  const { start, end } = zonedDateRange(digestDate, timeZone);
  const admin = createClient(url, serviceKey);

  const { data: matches, error: matchError } = await admin
    .from('matches')
    .select('id, candidate_id, company_id, job_id, created_at, job_listings(title, location)')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: true })
    .returns<MatchRow[]>();

  if (matchError) return json({ error: matchError.message }, 500);
  if (!matches?.length) return json({ sent: 0, digest_date: digestDate, match_count: 0 });

  const candidateIds = [...new Set(matches.map((match) => match.candidate_id))];
  const companyIds = [...new Set(matches.map((match) => match.company_id))];
  const userIds = [...new Set([...candidateIds, ...companyIds])];

  const [{ data: candidateProfiles }, { data: companyProfiles }, { data: alreadySent }] = await Promise.all([
    admin.from('profiles').select('id, full_name, daily_match_digest_enabled').in('id', userIds).returns<ProfileRow[]>(),
    admin.from('company_profiles').select('id, company_name').in('id', companyIds).returns<CompanyProfileRow[]>(),
    admin
      .from('daily_match_digest_emails')
      .select('user_id')
      .eq('digest_date', digestDate)
      .not('sent_at', 'is', null),
  ]);

  const candidateNameById = new Map((candidateProfiles || []).map((profile) => [profile.id, profile.full_name || 'Kandidat']));
  const digestEnabledById = new Map((candidateProfiles || []).map((profile) => [profile.id, profile.daily_match_digest_enabled !== false]));
  const companyNameById = new Map((companyProfiles || []).map((profile) => [profile.id, profile.company_name || 'Firma']));
  const sentUserIds = new Set((alreadySent || []).map((row: { user_id: string }) => row.user_id));

  let sent = 0;
  let skipped = 0;
  const errors: Array<{ user_id: string; error: string }> = [];

  for (const userId of userIds) {
    const userMatches = matches.filter((match) => match.candidate_id === userId || match.company_id === userId);
    if (!userMatches.length) continue;
    if (digestEnabledById.get(userId) === false) {
      skipped += 1;
      continue;
    }
    if (sentUserIds.has(userId)) {
      skipped += 1;
      continue;
    }

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const to = authUser.user?.email;
    if (!to) {
      errors.push({ user_id: userId, error: 'Missing user email' });
      await admin.from('daily_match_digest_emails').upsert({
        user_id: userId,
        digest_date: digestDate,
        match_count: userMatches.length,
        error: 'Missing user email',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,digest_date' });
      continue;
    }

    const isCandidate = userMatches.some((match) => match.candidate_id === userId);
    const title = userMatches.length === 1
      ? 'Danas imaš 1 novi match'
      : `Danas imaš ${userMatches.length} nova meča`;
    const lines = userMatches.map((match) => {
      const jobTitle = match.job_listings?.title || 'Oglas';
      const location = match.job_listings?.location || 'Lokacija nije navedena';
      const otherName = match.candidate_id === userId
        ? companyNameById.get(match.company_id) || 'Firma'
        : candidateNameById.get(match.candidate_id) || 'Kandidat';
      return { jobTitle, location, otherName };
    });

    const listHtml = lines.map((line) => `
      <li style="margin:0 0 14px; padding:14px; border-radius:16px; background:#171c31;">
        <strong style="display:block; color:#f8f7ff; font-size:16px;">${escapeHtml(line.jobTitle)}</strong>
        <span style="display:block; color:#cfd5ff; margin-top:6px;">${escapeHtml(line.otherName)} • ${escapeHtml(line.location)}</span>
      </li>
    `).join('');

    const textList = lines.map((line) => `- ${line.jobTitle} | ${line.otherName} | ${line.location}`).join('\n');
    const safeAppUrl = escapeHtml(appUrl);

    try {
      await sendEmail({
        from: fromEmail,
        to,
        subject: `JobHop dnevni pregled: ${userMatches.length} match${userMatches.length === 1 ? '' : 'a'}`,
        text: `${title}\n\n${textList}\n\nOtvori JobHop i nastavi razgovor u tabu Mecevi.`,
        html: `
          <div style="font-family: Inter, Arial, sans-serif; background:#070812; color:#f8f7ff; padding:28px;">
            <div style="max-width:600px; margin:0 auto; background:#111525; border:1px solid #252b45; border-radius:24px; padding:28px;">
              <p style="margin:0 0 10px; color:#9aa6ff; font-weight:700; letter-spacing:.08em; text-transform:uppercase;">JobHop</p>
              <h1 style="margin:0 0 12px; font-size:30px; line-height:1.15;">${escapeHtml(title)}</h1>
              <p style="margin:0 0 20px; color:#c8cee8; line-height:1.55;">
                ${isCandidate ? 'Firmama si zapao za oko danas.' : 'Kandidati su pokazali interesovanje danas.'}
                Push notifikacije ostaju za svaki novi match, a ovo je miran pregled dana.
              </p>
              <ul style="list-style:none; padding:0; margin:0 0 22px;">${listHtml}</ul>
              <a href="${safeAppUrl}" style="display:inline-block; background:#7c5cff; color:white; text-decoration:none; padding:14px 20px; border-radius:14px; font-weight:800;">Otvori mečeve</a>
            </div>
          </div>
        `,
      });

      await admin.from('daily_match_digest_emails').upsert({
        user_id: userId,
        digest_date: digestDate,
        match_count: userMatches.length,
        sent_at: new Date().toISOString(),
        error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,digest_date' });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Digest delivery failed';
      errors.push({ user_id: userId, error: message });
      await admin.from('daily_match_digest_emails').upsert({
        user_id: userId,
        digest_date: digestDate,
        match_count: userMatches.length,
        error: message,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,digest_date' });
    }
  }

  return json({
    sent,
    skipped,
    errors,
    digest_date: digestDate,
    match_count: matches.length,
  });
});
