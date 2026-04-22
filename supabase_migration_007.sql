-- Reactions table
CREATE TABLE IF NOT EXISTS reactions (
  article_slug  TEXT    NOT NULL,
  reaction      TEXT    NOT NULL,
  count         INT     NOT NULL DEFAULT 0,
  PRIMARY KEY (article_slug, reaction)
);

-- Allow public read
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read reactions" ON reactions FOR SELECT USING (true);
CREATE POLICY "service write reactions" ON reactions FOR ALL USING (true);

-- Atomic increment
CREATE OR REPLACE FUNCTION increment_reaction(p_slug TEXT, p_reaction TEXT)
RETURNS TABLE (reaction TEXT, count INT) AS $$
BEGIN
  INSERT INTO reactions (article_slug, reaction, count)
  VALUES (p_slug, p_reaction, 1)
  ON CONFLICT (article_slug, reaction)
  DO UPDATE SET count = reactions.count + 1;

  RETURN QUERY
    SELECT r.reaction, r.count
    FROM reactions r
    WHERE r.article_slug = p_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
