select cron.unschedule(jobid)
from cron.job
where jobname in ('jobswipe-daily-match-digest', 'jobhop-daily-match-digest');

select cron.schedule(
  'jobhop-daily-match-digest',
  '0 20 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'jobhop_project_url') || '/functions/v1/send-daily-match-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-digest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'jobhop_digest_cron_secret')
      ),
      body := jsonb_build_object('timezone', 'Europe/Belgrade')
    ) as request_id;
  $$
);
