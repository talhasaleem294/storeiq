-- Grant delete permission on shopify_connections to authenticated role
-- (migration 20240002 only granted select)
grant delete on shopify_connections to authenticated;

-- Add missing DELETE RLS policy for shopify_connections
-- Owners and admins can disconnect (per RBAC table in project spec)
create policy "owners and admins can delete shopify connection"
  on shopify_connections for delete
  using (
    exists (
      select 1 from workspace_members
      where workspace_id = shopify_connections.workspace_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );
