-- ============================================================
-- قفل أمني: حصر الكتابة (إضافة/تعديل/حذف) ببريد الهوست فقط
-- شغّله مرة واحدة في: Supabase Dashboard → SQL Editor
--
-- ⚠️ قبل التشغيل: بدّل HOST_EMAIL_HERE@example.com ببريد حساب
--    الهوست الفعلي (نفس البريد اللي تسجّل فيه دخول /host).
--    تقدر تضيف أكثر من بريد: in ('a@x.com', 'b@x.com')
-- ============================================================

-- 1) دالة التحقق من الهوست
create or replace function public.is_host()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') in ('HOST_EMAIL_HERE@example.com');
$$;

-- 2) حذف كل سياسات الكتابة القديمة على الجدولين مهما كانت أسماؤها
--    (القراءة العامة ما ننلمسها — تبقى مفتوحة للزوار)
do $$
declare p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('events', 'articles')
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- 3) سياسات الكتابة الجديدة — الهوست فقط

-- الفعاليات
create policy "events_host_insert" on public.events
  for insert to authenticated
  with check (public.is_host());

create policy "events_host_update" on public.events
  for update to authenticated
  using (public.is_host())
  with check (public.is_host());

create policy "events_host_delete" on public.events
  for delete to authenticated
  using (public.is_host());

-- المقالات
create policy "articles_host_insert" on public.articles
  for insert to authenticated
  with check (public.is_host());

create policy "articles_host_update" on public.articles
  for update to authenticated
  using (public.is_host())
  with check (public.is_host());

create policy "articles_host_delete" on public.articles
  for delete to authenticated
  using (public.is_host());

-- 4) حاوية الصور: الرفع/التعديل/الحذف للهوست فقط (القراءة تبقى عامة)
drop policy if exists "images_auth_insert" on storage.objects;
create policy "images_auth_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-images' and public.is_host());

drop policy if exists "images_auth_update" on storage.objects;
create policy "images_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'event-images' and public.is_host());

drop policy if exists "images_auth_delete" on storage.objects;
create policy "images_auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-images' and public.is_host());

-- ============================================================
-- للتأكد بعد التشغيل: هذا الاستعلام يعرض كل السياسات الحالية
-- ============================================================
-- select tablename, policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public' and tablename in ('events', 'articles')
-- order by tablename, cmd;
