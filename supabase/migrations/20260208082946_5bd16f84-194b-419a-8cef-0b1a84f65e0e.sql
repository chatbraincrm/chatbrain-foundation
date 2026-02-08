
-- Table to track the last time a user read a specific thread
CREATE TABLE public.thread_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (thread_id, user_id)
);

-- Enable RLS
ALTER TABLE public.thread_reads ENABLE ROW LEVEL SECURITY;

-- Users can read their own read-tracking records within their tenant
CREATE POLICY "Users can view their own thread reads"
  ON public.thread_reads FOR SELECT
  USING (
    auth.uid() = user_id
    AND public.is_tenant_member(auth.uid(), tenant_id)
  );

-- Users can insert their own read-tracking records
CREATE POLICY "Users can insert their own thread reads"
  ON public.thread_reads FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_tenant_member(auth.uid(), tenant_id)
  );

-- Users can update their own read-tracking records
CREATE POLICY "Users can update their own thread reads"
  ON public.thread_reads FOR UPDATE
  USING (
    auth.uid() = user_id
    AND public.is_tenant_member(auth.uid(), tenant_id)
  );

-- Index for fast lookups
CREATE INDEX idx_thread_reads_user_thread ON public.thread_reads (user_id, thread_id);
CREATE INDEX idx_thread_reads_tenant ON public.thread_reads (tenant_id, user_id);

-- Function to get unread message count per thread for the current user
CREATE OR REPLACE FUNCTION public.get_unread_counts(_tenant_id uuid)
RETURNS TABLE(thread_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    m.thread_id,
    COUNT(m.id) AS unread_count
  FROM public.messages m
  LEFT JOIN public.thread_reads tr
    ON tr.thread_id = m.thread_id AND tr.user_id = auth.uid()
  WHERE m.tenant_id = _tenant_id
    AND (tr.last_read_at IS NULL OR m.created_at > tr.last_read_at)
    AND m.sender_user_id IS DISTINCT FROM auth.uid()
  GROUP BY m.thread_id
  HAVING COUNT(m.id) > 0
$$;

-- Function to mark a thread as read
CREATE OR REPLACE FUNCTION public.mark_thread_read(_tenant_id uuid, _thread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_tenant_member(_user_id, _tenant_id) THEN
    RAISE EXCEPTION 'Not a member of this tenant';
  END IF;

  INSERT INTO public.thread_reads (tenant_id, thread_id, user_id, last_read_at)
  VALUES (_tenant_id, _thread_id, _user_id, now())
  ON CONFLICT (thread_id, user_id)
  DO UPDATE SET last_read_at = now();
END;
$$;
