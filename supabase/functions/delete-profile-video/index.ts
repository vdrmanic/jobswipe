import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, DeleteObjectCommand } from 'npm:@aws-sdk/client-s3@3.731.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const awsRegion = Deno.env.get('AWS_REGION');
  const bucket = Deno.env.get('S3_BUCKET');
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !serviceKey || !awsRegion || !bucket || !authorization) {
    return Response.json({ error: 'Server nije podešen za brisanje videa.' }, { status: 500, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const jwt = authorization.replace('Bearer ', '');
  const { data: userData, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !userData.user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  const body = await request.json().catch(() => null);
  const videoId = String(body?.videoId || '');
  if (!videoId) return Response.json({ error: 'Nedostaje video.' }, { status: 400, headers: corsHeaders });

  const { data: video, error } = await admin
    .from('profile_videos')
    .select('id, user_id, s3_key, status')
    .eq('id', videoId)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  if (!video || video.user_id !== userData.user.id) {
    return Response.json({ error: 'Video nije pronađen.' }, { status: 404, headers: corsHeaders });
  }

  const s3 = new S3Client({ region: awsRegion });
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: video.s3_key }));

  const { error: updateError } = await admin
    .from('profile_videos')
    .update({ status: 'deleted' })
    .eq('id', videoId);

  if (updateError) return Response.json({ error: updateError.message }, { status: 500, headers: corsHeaders });

  return Response.json({ ok: true }, { headers: corsHeaders });
});
