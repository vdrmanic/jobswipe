import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.731.1';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.731.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const allowedMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const maxFileSize = 100 * 1024 * 1024;

const extensionForMime = (mimeType: string) => {
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/quicktime') return 'mov';
  if (mimeType === 'video/webm') return 'webm';
  return 'mp4';
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
    return Response.json({ error: 'Server nije podešen za video upload.' }, { status: 500, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const jwt = authorization.replace('Bearer ', '');
  const { data: userData, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !userData.user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  const body = await request.json().catch(() => null);
  const fileName = String(body?.fileName || 'profile-video').replace(/[^\w.\-]+/g, '-').slice(0, 90);
  const mimeType = String(body?.mimeType || '');
  const fileSize = Number(body?.fileSize || 0);

  if (!allowedMimeTypes.has(mimeType)) {
    return Response.json({ error: 'Video mora biti MP4, MOV ili WEBM.' }, { status: 400, headers: corsHeaders });
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxFileSize) {
    return Response.json({ error: 'Video može imati najviše 100 MB.' }, { status: 400, headers: corsHeaders });
  }

  const extension = extensionForMime(mimeType);
  const key = `profiles/${userData.user.id}/${crypto.randomUUID()}.${extension}`;
  const s3 = new S3Client({ region: awsRegion });
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return Response.json({
    uploadUrl,
    key,
    fileName,
    mimeType,
    maxFileSize,
    expiresIn: 300,
  }, { headers: corsHeaders });
});
