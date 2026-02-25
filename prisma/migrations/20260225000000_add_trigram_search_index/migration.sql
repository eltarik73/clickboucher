-- Enable pg_trgm extension for fuzzy/trigram search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on products.name for fast ILIKE / similarity queries
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name gin_trgm_ops);
