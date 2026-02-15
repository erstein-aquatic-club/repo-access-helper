-- Create strength_folders table
CREATE TABLE IF NOT EXISTS strength_folders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('session', 'exercise')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add folder_id to strength_sessions
ALTER TABLE strength_sessions
  ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES strength_folders(id) ON DELETE SET NULL;

-- Add folder_id to dim_exercices
ALTER TABLE dim_exercices
  ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES strength_folders(id) ON DELETE SET NULL;

-- RLS: allow authenticated users to read/write folders
ALTER TABLE strength_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read folders"
  ON strength_folders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert folders"
  ON strength_folders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update folders"
  ON strength_folders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete folders"
  ON strength_folders FOR DELETE
  TO authenticated
  USING (true);
