-- ============================================================
-- MIGRATION 20240007: Supervisor role + workspace invites
-- ============================================================

-- ── 1. Update workspace_members role constraint ───────────────────────────────
ALTER TABLE workspace_members
  DROP CONSTRAINT workspace_members_role_check;

ALTER TABLE workspace_members
  ADD CONSTRAINT workspace_members_role_check
    CHECK (role IN ('owner', 'admin', 'supervisor'));

-- ── 2. New helper: is_workspace_owner_or_admin ───────────────────────────────
CREATE OR REPLACE FUNCTION is_workspace_owner_or_admin(ws_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION is_workspace_owner_or_admin(uuid) TO authenticated;

-- ── 3. Update workspace_members RLS policies ─────────────────────────────────
-- Drop old owner-only policies
DROP POLICY IF EXISTS "owners can insert members" ON workspace_members;
DROP POLICY IF EXISTS "owners can remove members" ON workspace_members;
DROP POLICY IF EXISTS "owners can update member roles" ON workspace_members;

-- Insert: owner can insert any role; admin can only directly insert supervisors
-- (admins invite admins via Edge Function using service role)
CREATE POLICY "owners and admins can insert members"
  ON workspace_members FOR INSERT
  WITH CHECK (
    is_workspace_owner(workspace_id)
    OR (
      is_workspace_owner_or_admin(workspace_id)
      AND role = 'supervisor'
    )
  );

-- Delete: owner can remove anyone except themselves; admin can only remove supervisors
CREATE POLICY "owners and admins can remove members"
  ON workspace_members FOR DELETE
  USING (
    -- Prevent removing the workspace owner
    (SELECT role FROM workspace_members wm2
     WHERE wm2.workspace_id = workspace_members.workspace_id
       AND wm2.user_id = workspace_members.user_id) <> 'owner'
    AND (
      is_workspace_owner(workspace_id)
      OR (
        is_workspace_owner_or_admin(workspace_id)
        AND (SELECT role FROM workspace_members wm3
             WHERE wm3.workspace_id = workspace_members.workspace_id
               AND wm3.user_id = workspace_members.user_id) = 'supervisor'
      )
    )
  );

-- Update roles: owner only
CREATE POLICY "owners can update member roles"
  ON workspace_members FOR UPDATE
  USING (is_workspace_owner(workspace_id));

-- ── 4. workspace_invites table ────────────────────────────────────────────────
CREATE TABLE workspace_invites (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_email text        NOT NULL,
  role          text        NOT NULL CHECK (role IN ('admin', 'supervisor')),
  invited_by    uuid        NOT NULL REFERENCES auth.users(id),
  token         uuid        NOT NULL DEFAULT gen_random_uuid(),
  accepted_at   timestamptz,
  expires_at    timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate pending invites for same email+workspace
CREATE UNIQUE INDEX workspace_invites_pending_unique
  ON workspace_invites (workspace_id, invited_email)
  WHERE accepted_at IS NULL;

CREATE INDEX workspace_invites_workspace ON workspace_invites (workspace_id, created_at DESC);
CREATE INDEX workspace_invites_token ON workspace_invites (token) WHERE accepted_at IS NULL;

ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON workspace_invites TO authenticated;

CREATE POLICY "owners and admins can view invites"
  ON workspace_invites FOR SELECT
  USING (is_workspace_owner_or_admin(workspace_id));

CREATE POLICY "owners and admins can insert invites"
  ON workspace_invites FOR INSERT
  WITH CHECK (
    is_workspace_owner_or_admin(workspace_id)
    AND invited_by = auth.uid()
  );

CREATE POLICY "owners and admins can delete invites"
  ON workspace_invites FOR DELETE
  USING (is_workspace_owner_or_admin(workspace_id));

-- ── 5. RPC: get_workspace_members_with_email ──────────────────────────────────
CREATE OR REPLACE FUNCTION get_workspace_members_with_email(ws_id uuid)
RETURNS TABLE (
  workspace_id  uuid,
  user_id       uuid,
  role          text,
  email         text,
  created_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT is_workspace_owner_or_admin(ws_id) THEN
    RAISE EXCEPTION 'Unauthorized' USING errcode = 'PGRST301';
  END IF;

  RETURN QUERY
    SELECT
      wm.workspace_id,
      wm.user_id,
      wm.role,
      u.email::text,
      wm.created_at
    FROM workspace_members wm
    JOIN auth.users u ON u.id = wm.user_id
    WHERE wm.workspace_id = ws_id
    ORDER BY wm.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_workspace_members_with_email(uuid) TO authenticated;

-- ── 6. RPC: remove_workspace_member ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION remove_workspace_member(ws_id uuid, target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role  text;
  target_role  text;
BEGIN
  SELECT role INTO caller_role
  FROM workspace_members
  WHERE workspace_id = ws_id AND user_id = auth.uid();

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this workspace' USING errcode = 'PGRST301';
  END IF;

  IF caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized — insufficient permissions' USING errcode = 'PGRST301';
  END IF;

  SELECT role INTO target_role
  FROM workspace_members
  WHERE workspace_id = ws_id AND user_id = target_user_id;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this workspace' USING errcode = 'P0002';
  END IF;

  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove the workspace owner';
  END IF;

  IF caller_role = 'admin' AND target_role IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Admins can only remove supervisors';
  END IF;

  DELETE FROM workspace_members
  WHERE workspace_id = ws_id AND user_id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION remove_workspace_member(uuid, uuid) TO authenticated;

-- ── 7. RPC: accept_workspace_invite ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION accept_workspace_invite(invite_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv  workspace_invites%ROWTYPE;
  uid  uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = 'PGRST301';
  END IF;

  SELECT * INTO inv
  FROM workspace_invites
  WHERE token = invite_token
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or expired' USING errcode = 'P0002';
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (inv.workspace_id, uid, inv.role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE workspace_invites
  SET accepted_at = now()
  WHERE id = inv.id;

  RETURN json_build_object(
    'workspace_id', inv.workspace_id,
    'role', inv.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_workspace_invite(uuid) TO authenticated;
