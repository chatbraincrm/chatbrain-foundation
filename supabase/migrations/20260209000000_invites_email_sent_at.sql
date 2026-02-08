-- Add email_sent_at to invites for tracking invite email delivery
ALTER TABLE public.invites
ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

COMMENT ON COLUMN public.invites.email_sent_at IS 'When the invite email was last sent (null if never sent)';
