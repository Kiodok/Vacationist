-- Fix: column reference "id" is ambiguous (code 42702) in create_trip_message.
--
-- RETURNS TABLE declares `id UUID` as an output variable. The bare `id` in
-- "RETURNING id INTO v_id" is ambiguous between that variable and
-- trip_messages.id. Fix: alias the INSERT target and qualify with the alias.
--
-- Also pre-qualify `created_by` and `text` in RETURNING to be safe (those
-- RETURNS TABLE output columns exist as trip_messages columns too).

CREATE OR REPLACE FUNCTION public.create_trip_message(
  p_trip_id UUID,
  p_text    TEXT
)
RETURNS TABLE (
  id         UUID,
  trip_id    UUID,
  created_by UUID,
  text       TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  sender     JSON
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_key    TEXT;
  v_id     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF char_length(p_text) > 2000 THEN
    RAISE EXCEPTION 'Message exceeds 2000 characters';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members tm
    WHERE tm.trip_id = p_trip_id AND tm.user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Not a trip member';
  END IF;

  v_key := private.get_chat_encryption_key();

  -- Alias the target table so RETURNING can qualify columns unambiguously
  -- (bare "id" would collide with the RETURNS TABLE output variable).
  INSERT INTO public.trip_messages AS ins (trip_id, created_by, text)
  VALUES (p_trip_id, v_caller, extensions.pgp_sym_encrypt(btrim(p_text), v_key))
  RETURNING ins.id INTO v_id;

  RETURN QUERY
  SELECT
    m.id,
    m.trip_id,
    m.created_by,
    extensions.pgp_sym_decrypt(m.text, v_key) AS text,
    m.created_at,
    m.updated_at,
    m.deleted_at,
    json_build_object('name', u.name, 'avatar_url', u.avatar_url) AS sender
  FROM public.trip_messages m
  JOIN public.users u ON u.id = m.created_by
  WHERE m.id = v_id;
END;
$$;
