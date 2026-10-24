-- Close a privilege-escalation path: the "own profile update" policy let a
-- signed-in user update ANY column of their own profile with the anon key,
-- including `role` (e.g. patient -> admin). Roles are only ever set by
-- server-side code using the service role.

-- 1. Users may only update their own row, and the row must stay theirs.
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 2. Column-level: browsers may only change their display name.
revoke update on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- 3. Belt and braces: block role/email changes from anything but the service role.
create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.email is distinct from old.email)
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'role and email can only be changed by TrialCave';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.prevent_profile_role_change();
