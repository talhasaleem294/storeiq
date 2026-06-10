-- Add trial_started_at to admin_get_all_workspaces so the admin panel
-- can display trial days remaining per workspace.
-- DROP required because PostgreSQL disallows CREATE OR REPLACE when the
-- RETURNS TABLE signature changes (adding a column counts as a type change).
DROP FUNCTION IF EXISTS admin_get_all_workspaces();

CREATE FUNCTION admin_get_all_workspaces()
RETURNS TABLE (
  id                  uuid,
  name                text,
  owner_email         text,
  subscription_status text,
  selected_plan       text,
  created_at          timestamptz,
  trial_started_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.email() != 'admin@storeiq.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
    SELECT
      w.id,
      w.name,
      u.email::text AS owner_email,
      w.subscription_status,
      w.selected_plan,
      w.created_at,
      w.trial_started_at
    FROM  workspaces  w
    JOIN  auth.users  u ON u.id = w.owner_user_id
    ORDER BY w.created_at DESC;
END;
$$;
