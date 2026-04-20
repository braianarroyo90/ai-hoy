-- Run in Supabase SQL Editor
ALTER TABLE articles ADD COLUMN IF NOT EXISTS slug text unique;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS es_body text;

-- Generate slugs for existing published articles
UPDATE articles
SET slug = lower(regexp_replace(regexp_replace(es_title, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g')) || '-' || substr(id::text, 1, 8)
WHERE slug IS NULL AND es_title IS NOT NULL;
