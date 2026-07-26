// إعداد عميل Supabase — المفتاح هنا هو المفتاح المنشور (publishable/anon) فقط.
// لا تضع مفتاح service_role هنا أبداً.
const SUPABASE_URL = 'https://bldrfbuulyrmfkrjiqsa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lEaQB7GBlCLpiSnCZHSpfg_NbgqyDJl';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// اسم حاوية الصور في Supabase Storage (لازم تكون منشأة — راجع supabase_setup.sql)
const IMAGES_BUCKET = 'event-images';

// تنسيق التاريخ بالعربي
function formatDateAr(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ar-SA-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// الحالة الفعلية: أي فعالية تاريخها قبل اليوم تعتبر منتهية
function effectiveStatus(ev) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(ev.event_date + 'T00:00:00');
  if (d < today) return 'past';
  return ev.status === 'past' ? 'past' : 'upcoming';
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
