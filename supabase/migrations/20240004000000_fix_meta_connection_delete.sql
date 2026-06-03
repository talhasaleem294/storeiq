-- Grant delete permission on meta_connections to authenticated role
grant delete on meta_connections to authenticated;

-- Add DELETE RLS policy for meta_connections
-- Owners and admins can disconnect (per RBAC table in project spec)
create policy "owners and admins can delete meta connection"
  on meta_connections for delete
  using (
    exists (
      select 1 from workspace_members
      where workspace_id = meta_connections.workspace_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );
