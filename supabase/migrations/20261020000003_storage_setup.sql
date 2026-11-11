-- Migration: Storage Bucket Setup for Task Attachments (Module 6: FR-COL-02 & FR-COL-03)
-- Creates private attachments bucket and configures storage policies for authenticated tenant access.

-- 1. Create or update private attachments bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false, -- Private bucket: downloads go through signed URLs / authorized API (FR-COL-03)
  10485760, -- 10MB limit (FR-COL-02)
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'application/zip', 'application/x-zip-compressed',
    'application/json', 'text/csv'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760;

-- 2. Storage Policies for authenticated users
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Authenticated users can upload attachments' and tablename = 'objects') then
    create policy "Authenticated users can upload attachments"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'attachments');
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Authenticated users can download attachments' and tablename = 'objects') then
    create policy "Authenticated users can download attachments"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'attachments');
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Authenticated users can delete their attachments' and tablename = 'objects') then
    create policy "Authenticated users can delete their attachments"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'attachments');
  end if;
end $$;
