CREATE TABLE swimmer_performances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    swimmer_iuf TEXT NOT NULL,
    event_code TEXT NOT NULL,
    pool_length INTEGER NOT NULL,
    time_seconds DOUBLE PRECISION NOT NULL,
    time_display TEXT,
    competition_name TEXT,
    competition_date DATE,
    competition_location TEXT,
    ffn_points INTEGER,
    source TEXT NOT NULL DEFAULT 'ffn',
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(swimmer_iuf, event_code, pool_length, competition_date, time_seconds)
);
CREATE INDEX idx_perf_iuf ON swimmer_performances(swimmer_iuf);
CREATE INDEX idx_perf_user ON swimmer_performances(user_id);
CREATE INDEX idx_perf_event ON swimmer_performances(event_code, pool_length);
CREATE INDEX idx_perf_date ON swimmer_performances(competition_date);

ALTER TABLE swimmer_performances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swimmer_performances_read" ON swimmer_performances FOR SELECT USING (true);
CREATE POLICY "swimmer_performances_insert" ON swimmer_performances FOR INSERT WITH CHECK (true);
