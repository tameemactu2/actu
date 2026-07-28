-- ============================================================
-- جدول محتوى الموقع القابل للتعديل من لوحة الهوست
-- شغّله مرة واحدة في: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1) إنشاء الجدول
create table if not exists public.site_content (
  key   text primary key,
  value text not null default ''
);

alter table public.site_content enable row level security;

-- 2) القراءة عامة — الكتابة للهوست فقط
create policy "site_content_public_read" on public.site_content
  for select to anon, authenticated using (true);

create policy "site_content_host_update" on public.site_content
  for update to authenticated
  using (public.is_host()) with check (public.is_host());

create policy "site_content_host_insert" on public.site_content
  for insert to authenticated
  with check (public.is_host());

create policy "site_content_host_delete" on public.site_content
  for delete to authenticated
  using (public.is_host());

-- 3) القيم الافتراضية (المحتوى الحالي المثبّت بالكود)
insert into public.site_content (key, value) values
  -- الهيرو (الصفحة الرئيسية)
  ('hero_eyebrow',  'نادٍ طلابي · جامعة الملك سعود'),
  ('hero_title',    'نادي العلوم الاكتوارية'),
  ('hero_en',       'Actuarial Science Club — King Saud University'),
  ('hero_tagline',  'نحو مستقبل اكتواري مستدام'),

  -- صفحة «من نحن»
  ('about_text',    'نادي العلوم الاكتوارية نادٍ طلابي في جامعة الملك سعود، يهدف إلى ربط طلبة الرياضيات الاكتوارية والمالية بسوق العمل: من الاختبارات المهنية إلى التحليل المالي وإدارة المخاطر. نبني هذا الطريق عبر ورش عمل تطبيقية، ولقاءات مع اكتواريين ممارسين، ومسابقات معرفية تصقل مهارات الأعضاء وتوسّع شبكة علاقاتهم المهنية.'),

  ('about_cards',   '[{"title":"ورش عمل","text":"ورش تطبيقية في الاختبارات المهنية والأدوات الاكتوارية والمالية."},{"title":"لقاءات مهنية","text":"جلسات مع اكتواريين ممارسين وزيارات ميدانية لجهات تنظيمية وخدمية."},{"title":"مسابقات معرفية","text":"منافسات تحفّز الطلبة وتعمّق فهمهم للتخصص وتطبيقاته."}]'),

  ('about_vision',  'أن يكون النادي المرجع الطلابي الرائد في العلوم الاكتوارية على مستوى الجامعات السعودية.'),
  ('about_mission', 'تطوير الطالب الاكتواري مهنياً وتهيئته لسوق العمل: التوعية بالتخصص، ولقاءات مع اكتواريين ممارسين، وزيارات ميدانية لجهات تنظيمية وخدمية، وورشٌ وندوات، وبناء شبكة علاقات فاعلة بين الأعضاء.'),

  ('about_values',  '["الاحترافية","الابتكار","الانتماء","التعاون","المبادرة","المسؤولية"]'),

  ('about_goals',   '[{"title":"نشر الوعي بتخصص العلوم الاكتوارية","text":"من خلال اللقاءات وصفحات التواصل الاجتماعي."},{"title":"رفع جاهزية الطلبة لسوق العمل","text":"من خلال الزيارات الميدانية وورش العمل."},{"title":"دعم الطلبة للاستعداد للاختبارات المهنية","text":"من خلال الشراكات مع الجهات والمنصّات المتخصصة في التحضير للاختبارات."},{"title":"تعزيز البحث العلمي والمهني في العلوم الاكتوارية","text":"من خلال بناء المشاريع البحثية أو التقارير."},{"title":"تعزيز الترابط وبناء شبكة علاقات بين الطلاب الاكتواريين","text":"من خلال نشر روح العمل الجماعي وخلال اللقاءات."}]'),

  -- الفوتر (روابط التواصل)
  ('footer_x',        '#'),
  ('footer_linkedin',  '#'),
  ('footer_email',     'afmclub.ksu@gmail.com')

on conflict (key) do nothing;
