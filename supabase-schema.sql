create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inspections enable row level security;

drop policy if exists "Users can view their inspections" on public.inspections;
create policy "Users can view their inspections"
on public.inspections for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their inspections" on public.inspections;
create policy "Users can create their inspections"
on public.inspections for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their inspections" on public.inspections;
create policy "Users can update their inspections"
on public.inspections for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their inspections" on public.inspections;
create policy "Users can delete their inspections"
on public.inspections for delete
to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can view inspection photos" on storage.objects;
create policy "Users can view inspection photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'inspection-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can upload inspection photos" on storage.objects;
create policy "Users can upload inspection photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'inspection-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update inspection photos" on storage.objects;
create policy "Users can update inspection photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'inspection-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'inspection-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete inspection photos" on storage.objects;
create policy "Users can delete inspection photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'inspection-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
