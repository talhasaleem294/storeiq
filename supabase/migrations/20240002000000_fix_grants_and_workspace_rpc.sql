-- Grant table-level permissions to authenticated and anon roles
-- (Supabase dashboard does this automatically; migrations do not)
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on workspaces to authenticated;
grant select on workspaces to anon;

grant select, insert, update, delete on workspace_members to authenticated;
grant select on workspace_members to anon;

grant select on shopify_connections to authenticated;
grant select on meta_connections to authenticated;

grant select, insert, update, delete on orders to authenticated;
grant select, insert, update, delete on ads_data to authenticated;

-- Safe workspace creation function (security definer bypasses RLS,
-- but explicitly enforces auth.uid() so it cannot be abused)
create or replace function create_workspace(workspace_name text)
returns workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace workspaces;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'PGRST301';
  end if;

  insert into workspaces (name, owner_user_id)
  values (workspace_name, auth.uid())
  returning * into new_workspace;

  return new_workspace;
end;
$$;

grant execute on function create_workspace(text) to authenticated;
