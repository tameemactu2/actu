-- ============================================================
-- إضافة دعم عدة صور لكل فعالية ومقال
-- شغّل هذا مرة واحدة في: Supabase Dashboard → SQL Editor
-- ============================================================

-- عمود قائمة الصور (روابط) — يبقى image_url كصورة الغلاف للبطاقات
alter table public.events   add column if not exists images text[] default '{}';
alter table public.articles add column if not exists images text[] default '{}';

-- نقل الصورة الحالية (إن وجدت) إلى قائمة الصور للسجلات القديمة
update public.events
  set images = array[image_url]
  where image_url is not null and (images is null or array_length(images,1) is null);

update public.articles
  set images = array[image_url]
  where image_url is not null and (images is null or array_length(images,1) is null);
