alter table public.matches
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error text;

comment on column public.matches.email_sent_at is
  'Set by send-match-emails edge function after match emails are delivered.';

comment on column public.matches.email_error is
  'Last email delivery error from send-match-emails edge function, if any.';
