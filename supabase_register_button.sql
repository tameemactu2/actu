-- ============================================================
-- زر التسجيل — إضافة مفاتيح المحتوى إلى جدول site_content
-- شغّله مرة وحدة من: Supabase Dashboard → SQL Editor
-- (اختياري: لوحة الهوست تنشئ المفاتيح تلقائياً عند أول حفظ)
-- ============================================================

insert into public.site_content (key, value) values
  ('register_label',   'سجّل معنا'),
  ('register_url',     ''),
  ('register_enabled', '1')
on conflict (key) do nothing;
