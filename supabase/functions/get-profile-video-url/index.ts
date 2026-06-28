import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, GetObjectCommand } from 'npm:@aws-sdk/client-s3@3.731.1';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.731.1';

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
    return Response.json({ error: 'Server nije podešen za video prikaz.' }, { status: 500, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const jwt = authorization.replace('Bearer ', '');
  const { error: authError } = await admin.auth.getUser(jwt);
  if (authError) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  const body = await request.json().catch(() => null);
  const videoId = String(body?.videoId || '');
  if (!videoId) return Response.json({ error: 'Nedostaje video.' }, { status: 400, headers: corsHeaders });

  const { data: video, error } = await admin
    .from('profile_videos')
    .select('id, s3_key, mime_type, status')
    .eq('id', videoId)
    .eq('status', 'ready')
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  if (!video) return Response.json({ error: 'Video nije pronađen.' }, { status: 404, headers: corsHeaders });

  const s3 = new S3Client({ region: awsRegion });
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: video.s3_key,
      ResponseContentType: video.mime_type,
    }),
    { expiresIn: 900 },
  );

  return Response.json({ url, expiresIn: 900 }, { headers: corsHeaders });
});
