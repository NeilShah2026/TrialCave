-- TrialCave storage buckets and policies (B7.4). Apply after 0002_rls.sql.

insert into storage.buckets (id, name, public) values ('documents','documents',false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('labs','labs',false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('scans','scans',false) on conflict do nothing;

-- Files live at <auth.uid()>/...; only the owner can read. Writes happen through server actions.
create policy "own files read" on storage.objects for select
  using (bucket_id in ('documents','labs','scans') and (storage.foldername(name))[1] = auth.uid()::text);
