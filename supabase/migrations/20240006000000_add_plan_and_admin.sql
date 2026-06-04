-- Migration 20240006: Add selected_plan to workspaces, update create_workspace RPC,
-- add admin-only RPCs for workspace management.
--
-- Test admin: admin@storeiq.com / admin1234 (pre-confirmed, no inbox needed).
-- ⚠️  Replace email + password with real credentials before production launch.
--     Must also update ADMIN_EMAIL in src/lib/constants.ts to match.

-- ─── A. Add selected_plan column ─────────────────────────────────────────────

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS selected_plan text DEFAULT NULL;

-- ─── B. Replace create_workspace RPC ─────────────────────────────────────────
-- Drop the old single-param version first so the new signature takes over cleanly.
-- Existing callers that omit selected_plan will use the DEFAULT NULL.

DROP FUNCTION IF EXISTS create_workspace(text);

CREATE OR REPLACE FUNCTION create_workspace(
  workspace_name text,
  selected_plan   text DEFAULT NULL
)
RETURNS workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace workspaces;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = 'PGRST301';
  END IF;

  INSERT INTO workspaces (name, owner_user_id, selected_plan)
  VALUES (workspace_name, auth.uid(), create_workspace.selected_plan)
  RETURNING * INTO new_workspace;

  RETURN new_workspace;
END;
$$;

GRANT EXECUTE ON FUNCTION create_workspace(text, text) TO authenticated;

-- ─── C. Admin RPC — list all workspaces with owner email ─────────────────────

CREATE OR REPLACE FUNCTION admin_get_all_workspaces()
RETURNS TABLE (
  id                  uuid,
  name                text,
  owner_email         text,
  subscription_status text,
  selected_plan       text,
  created_at          timestamptz
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
      w.created_at
    FROM  workspaces  w
    JOIN  auth.users  u ON u.id = w.owner_user_id
    ORDER BY w.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_all_workspaces() TO authenticated;

-- ─── D. Admin RPC — activate / deactivate a workspace ────────────────────────

CREATE OR REPLACE FUNCTION admin_set_subscription_status(
  target_workspace_id uuid,
  new_status          text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.email() != 'admin@storeiq.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF new_status NOT IN ('active', 'inactive', 'trial') THEN
    RAISE EXCEPTION 'Invalid status: %', new_status;
  END IF;

  UPDATE workspaces
  SET    subscription_status = new_status
  WHERE  id = target_workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_subscription_status(uuid, text) TO authenticated;

-- ─── E. Seed test admin user ──────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Creates admin@storeiq.com / admin1234 for local testing.
-- Email is pre-confirmed so no inbox needed.
-- ⚠️  Replace credentials before real launch.

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@storeiq.com',
  extensions.crypt('admin1234', extensions.gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'admin@storeiq.com'
);
