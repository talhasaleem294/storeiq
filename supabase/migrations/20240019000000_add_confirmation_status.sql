ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS confirmation_status text
  CHECK (confirmation_status IN ('confirmed', 'no_response', 'cancelled'));

CREATE INDEX IF NOT EXISTS orders_confirmation
  ON orders (workspace_id, confirmation_status);

GRANT UPDATE (confirmation_status) ON orders TO authenticated;
