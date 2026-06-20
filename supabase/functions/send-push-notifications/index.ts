import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!url || !serviceKey || !authorization) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const admin = createClient(url, serviceKey);
  const jwt = authorization.replace('Bearer ', '');
  const { error: authError } = await admin.auth.getUser(jwt);
  if (authError) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const { data: notifications, error } = await admin
    .from('app_notifications')
    .select('id, user_id, title, body, data')
    .is('push_sent_at', null)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });

  const userIds = [...new Set((notifications || []).map((item) => item.user_id))];
  const { data: tokens } = userIds.length
    ? await admin.from('device_push_tokens').select('user_id, token').in('user_id', userIds)
    : { data: [] };

  const messages = (notifications || []).flatMap((notification) =>
    (tokens || [])
      .filter((token) => token.user_id === notification.user_id)
      .map((token) => ({
        to: token.token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data,
      }))
  );

  if (messages.length) {
    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!pushResponse.ok) return Response.json({ error: await pushResponse.text() }, { status: 502, headers: corsHeaders });
  }

  const ids = (notifications || []).map((item) => item.id);
  if (ids.length) await admin.from('app_notifications').update({ push_sent_at: new Date().toISOString() }).in('id', ids);
  return Response.json({ processed: ids.length, messages: messages.length }, { headers: corsHeaders });
});

