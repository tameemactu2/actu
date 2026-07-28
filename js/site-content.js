// تحميل محتوى الموقع القابل للتعديل من جدول site_content
// يُستخدم في index.html و about.html

async function loadSiteContent(keys) {
  try {
    const { data, error } = await sb
      .from('site_content')
      .select('key, value')
      .in('key', keys);
    if (error) throw error;
    const map = {};
    (data || []).forEach((r) => (map[r.key] = r.value));
    return map;
  } catch (err) {
    console.error('تعذّر تحميل محتوى الموقع:', err);
    return {};
  }
}

// تعبئة عنصر بالنص — لو المفتاح موجود بالبيانات يستبدل، وإلا يبقى النص الافتراضي
function fillText(id, value) {
  if (value == null) return;
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function fillHtml(id, value) {
  if (value == null) return;
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

// تعبئة رابط href
function fillLink(id, value) {
  if (value == null) return;
  const el = document.getElementById(id);
  if (el) el.setAttribute('href', value);
}

function fillMailto(id, value) {
  if (value == null) return;
  const el = document.getElementById(id);
  if (el) el.setAttribute('href', 'mailto:' + value);
}
