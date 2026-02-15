-- Add folder and is_archived columns to swim_sessions_catalog
-- folder: path-based folder organization (e.g., "Endurance/Aérobie")
-- is_archived: replaces localStorage-based archiving

ALTER TABLE swim_sessions_catalog
ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT NULL;

ALTER TABLE swim_sessions_catalog
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_swim_sessions_folder
ON swim_sessions_catalog (folder);

CREATE INDEX IF NOT EXISTS idx_swim_sessions_archived
ON swim_sessions_catalog (is_archived);
