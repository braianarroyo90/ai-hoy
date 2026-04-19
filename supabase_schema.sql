-- Run this in Supabase SQL Editor

create table articles (
  id               uuid primary key default gen_random_uuid(),
  source_url       text unique not null,
  source_name      text,
  original_title   text,
  original_summary text,
  og_image         text,
  published_at     timestamptz,
  es_title         text,
  es_summary       text,
  tags             text[],
  category         text,
  status           text default 'raw',  -- raw | curated | rejected | published | error
  created_at       timestamptz default now()
);

-- Index for fast feed queries
create index articles_status_published_idx on articles (status, published_at desc);

-- Allow public read access (for Next.js frontend)
alter table articles enable row level security;

create policy "Public read published"
  on articles for select
  using (status = 'published');
