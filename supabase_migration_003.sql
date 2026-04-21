-- Migration 003: YouTube Shorts curator table

CREATE TABLE IF NOT EXISTS youtube_shorts (
  id           text PRIMARY KEY,        -- YouTube video ID
  title        text NOT NULL,
  channel      text,
  thumbnail    text,
  published_at timestamptz,
  fetched_at   timestamptz DEFAULT now()
);

-- Keep only recent shorts visible
CREATE INDEX IF NOT EXISTS youtube_shorts_published_idx
  ON youtube_shorts (published_at DESC);
