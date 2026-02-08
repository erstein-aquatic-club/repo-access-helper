CREATE TABLE import_logs (
    id SERIAL PRIMARY KEY,
    triggered_by INTEGER REFERENCES users(id),
    swimmer_iuf TEXT NOT NULL,
    swimmer_name TEXT,
    import_type TEXT NOT NULL DEFAULT 'performances',
    status TEXT NOT NULL DEFAULT 'pending',
    performances_found INTEGER,
    performances_imported INTEGER,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_import_logs_status ON import_logs(status);
CREATE INDEX idx_import_logs_iuf ON import_logs(swimmer_iuf);

ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_logs_read" ON import_logs FOR SELECT USING (true);
CREATE POLICY "import_logs_write" ON import_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "import_logs_update" ON import_logs FOR UPDATE USING (true);
