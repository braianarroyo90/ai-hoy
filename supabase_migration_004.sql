-- Migration 004: Radar semanal

CREATE TABLE IF NOT EXISTS radar_reports (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start   date NOT NULL,
  week_end     date NOT NULL,
  title        text NOT NULL,
  content      jsonb NOT NULL,
  published_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS radar_reports_published_idx
  ON radar_reports (published_at DESC);
