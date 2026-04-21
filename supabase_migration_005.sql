-- Entidades del mapa de poder: empresas, personas, modelos, productos
CREATE TABLE IF NOT EXISTS entities (
  id          TEXT PRIMARY KEY,           -- slug: "openai", "sam-altman"
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,              -- 'company' | 'person' | 'model' | 'product'
  description TEXT,
  article_count INT DEFAULT 0,
  last_seen   TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Relaciones entre entidades
CREATE TABLE IF NOT EXISTS entity_relations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id      TEXT REFERENCES entities(id) ON DELETE CASCADE,
  to_id        TEXT REFERENCES entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,            -- 'created' | 'invested_in' | 'acquired' | 'competes_with' | 'partnered_with' | 'founded_by' | 'works_at'
  article_id   UUID REFERENCES articles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_id, to_id, relation_type, article_id)
);

-- Qué artículos mencionan cada entidad
CREATE TABLE IF NOT EXISTS article_entities (
  article_id  UUID REFERENCES articles(id) ON DELETE CASCADE,
  entity_id   TEXT REFERENCES entities(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, entity_id)
);

-- RLS: lectura pública
ALTER TABLE entities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON entities         FOR SELECT USING (true);
CREATE POLICY "Public read" ON entity_relations FOR SELECT USING (true);
CREATE POLICY "Public read" ON article_entities FOR SELECT USING (true);
