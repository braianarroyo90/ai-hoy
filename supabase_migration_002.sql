-- Migration 002: Add video generation columns to articles table

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS video_url            text,
  ADD COLUMN IF NOT EXISTS video_generated_at   timestamptz;

-- Index for querying articles pending video generation
CREATE INDEX IF NOT EXISTS articles_video_pending_idx
  ON articles (published_at DESC)
  WHERE status = 'published' AND video_url IS NULL;
