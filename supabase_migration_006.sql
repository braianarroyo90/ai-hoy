-- View count for articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0;

-- Index for "lo más leído" queries
CREATE INDEX IF NOT EXISTS articles_view_count_idx ON articles(view_count DESC);

-- Atomic increment function (avoids race conditions)
CREATE OR REPLACE FUNCTION increment_view_count(article_slug TEXT)
RETURNS void AS $$
  UPDATE articles SET view_count = view_count + 1
  WHERE slug = article_slug AND status = 'published';
$$ LANGUAGE sql;
