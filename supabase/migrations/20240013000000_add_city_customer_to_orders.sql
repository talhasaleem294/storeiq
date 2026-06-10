ALTER TABLE orders ADD COLUMN IF NOT EXISTS city           text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id    text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email text;

CREATE INDEX IF NOT EXISTS orders_workspace_city
  ON orders (workspace_id, city);
