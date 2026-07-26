# موقع نادي العلوم الاكتوارية · جامعة الملك سعود

موقع ثابت (HTML/CSS/JS) متصل بـ Supabase — نفس أسلوب نشر Adaa: ارفعه على GitHub واربطه بـ Vercel وخلاص.

## الملفات
- `index.html` — الصفحة العامة: الفعاليات (مع فلترة الكل/القادمة/المنتهية) + المقالات + من نحن + الفوتر
- `host.html` — لوحة الهوست (توصلها فقط بكتابة `/host` بالرابط — ما فيه أي رابط لها بالموقع) (Supabase Auth حقيقي) + لوحة تحكم: إضافة/تعديل/حذف الفعاليات والمقالات + رفع الصور
- `js/config.js` — إعداد عميل Supabase (المفتاح المنشور فقط)
- `supabase_setup.sql` — **شغّله مرة واحدة** في SQL Editor بلوحة Supabase (ينشئ جدول المقالات + حاوية الصور وصلاحياتها)
- `supabase_security_lockdown.sql` — **قفل أمني (تم تشغيله ✅)**: يحصر الكتابة (إضافة/تعديل/حذف) ببريد الهوست فقط عبر دالة `is_host()` — القراءة تبقى عامة للزوار

## الأمان (الوضع الحالي)
- ✅ سياسات RLS محصورة ببريد الهوست فقط (`supabase_security_lockdown.sql`)
- ✅ التسجيل الجديد معطّل من Supabase: Authentication → Sign In / Providers → Email → Allow new users to sign up = OFF
- ✅ Leaked password protection مفعّل: Authentication → Attack Protection
- ✅ حاوية `event-images`: أنواع الملفات محصورة بـ `image/jpeg, image/png, image/webp` + حد حجم 5MB
- ✅ المحتوى الغني يتعقّم بـ DOMPurify قبل العرض في `article.html` و `event.html`
- ✅ Headers أمنية في `vercel.json`: HSTS + Permissions-Policy + X-Frame-Options + nosniff
- ⚠️ لو تغيّر بريد الهوست مستقبلاً: عدّل البريد داخل دالة `is_host()` من SQL Editor وأعد تشغيلها

## خطوات التشغيل
1. افتح Supabase Dashboard → SQL Editor → الصق محتوى `supabase_setup.sql` → Run.
2. ارفع المجلد على GitHub ثم اربطه بـ Vercel (أو Netlify) كموقع ثابت — ما يحتاج build.
3. افتح `رابط-موقعك/host` وسجّل دخول ببريد وكلمة مرور حساب الهوست اللي أنشأته في Supabase Auth.

## ملاحظات
- روابط X ولينكدإن في الفوتر placeholder (`#`) — حدّثها بحسابات النادي.
- بريد الفوتر placeholder برضه (`afmclub.ksu@gmail.com`) — غيّره بالبريد الرسمي.
- حالة الفعالية: أي فعالية تاريخها قبل اليوم تظهر تلقائياً «منتهية» حتى لو حالتها في القاعدة `upcoming`.
