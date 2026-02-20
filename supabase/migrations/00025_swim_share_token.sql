-- Add share_token to swim_sessions_catalog
ALTER TABLE swim_sessions_catalog
  ADD COLUMN share_token UUID DEFAULT NULL;

-- Unique partial index (only non-null tokens)
CREATE UNIQUE INDEX idx_swim_catalog_share_token
  ON swim_sessions_catalog (share_token) WHERE share_token IS NOT NULL;

-- Anon can SELECT shared sessions (by token)
CREATE POLICY swim_catalog_anon_shared ON swim_sessions_catalog
  FOR SELECT TO anon
  USING (share_token IS NOT NULL);

-- Anon can SELECT items of shared sessions
CREATE POLICY swim_items_anon_shared ON swim_session_items
  FOR SELECT TO anon
  USING (catalog_id IN (
    SELECT id FROM swim_sessions_catalog WHERE share_token IS NOT NULL
  ));

-- RPC to generate a share token (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION generate_swim_share_token(p_catalog_id INTEGER)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token UUID;
BEGIN
  v_token := gen_random_uuid();
  UPDATE swim_sessions_catalog
    SET share_token = v_token
    WHERE id = p_catalog_id AND share_token IS NULL;
  -- If already had a token (race condition), return existing
  SELECT share_token INTO v_token
    FROM swim_sessions_catalog
    WHERE id = p_catalog_id;
  RETURN v_token;
END;
$$;
