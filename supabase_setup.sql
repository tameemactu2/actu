-- ============================================================
-- نادي العلوم الاكتوارية — إعدادات Supabase المتبقية
-- شغّل هذا الملف مرة واحدة من: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1) جدول المقالات (نفس نمط صلاحيات جدول events)
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  image_url text,
  published_at timestamptz not null default now()
);

alter table public.articles enable row level security;

drop policy if exists "articles_public_read" on public.articles;
create policy "articles_public_read"
  on public.articles for select
  to anon, authenticated
  using (true);

drop policy if exists "articles_auth_insert" on public.articles;
create policy "articles_auth_insert"
  on public.articles for insert
  to authenticated
  with check (true);

drop policy if exists "articles_auth_update" on public.articles;
create policy "articles_auth_update"
  on public.articles for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "articles_auth_delete" on public.articles;
create policy "articles_auth_delete"
  on public.articles for delete
  to authenticated
  using (true);

-- 2) حاوية الصور (Storage bucket) — عامة للقراءة
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

-- صلاحيات الحاوية: الكل يقرأ، والمسجّل دخوله فقط يرفع/يعدّل/يحذف
drop policy if exists "images_public_read" on storage.objects;
create policy "images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'event-images');

drop policy if exists "images_auth_insert" on storage.objects;
create policy "images_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'event-images');

drop policy if exists "images_auth_update" on storage.objects;
create policy "images_auth_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'event-images');

drop policy if exists "images_auth_delete" on storage.objects;
create policy "images_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'event-images');
