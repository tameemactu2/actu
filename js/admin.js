// لوحة تحكم الهوست — مصادقة حقيقية عبر Supabase Auth + إدارة كاملة للفعاليات والمقالات

const loginView = document.getElementById('login-view');
const adminView = document.getElementById('admin-view');
const loginAlert = document.getElementById('login-alert');
const adminAlert = document.getElementById('admin-alert');

function showAlert(el, msg, ok = false) {
  el.textContent = msg;
  el.className = `alert show ${ok ? 'alert-ok' : 'alert-error'}`;
  if (ok) setTimeout(() => el.classList.remove('show'), 3500);
}

// ================= المصادقة =================
async function refreshAuthUI() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    loginView.classList.add('hidden');
    adminView.classList.remove('hidden');
    document.getElementById('who').textContent = session.user.email;
    loadAdminEvents();
    loadAdminArticles();
  } else {
    adminView.classList.add('hidden');
    loginView.classList.remove('hidden');
  }
}

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) {
    showAlert(loginAlert, 'اكتب البريد وكلمة المرور.');
    return;
  }
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'جارٍ الدخول…';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  btn.textContent = 'دخول';
  if (error) {
    showAlert(loginAlert, 'بيانات الدخول غير صحيحة. تأكد من البريد وكلمة المرور.');
    console.error(error);
    return;
  }
  refreshAuthUI();
});

document.getElementById('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await sb.auth.signOut();
  refreshAuthUI();
});

sb.auth.onAuthStateChange(() => refreshAuthUI());

// ================= رفع الصور =================
async function uploadImage(file, folder) {
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = sb.storage.from(IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function bindImagePreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  input.addEventListener('change', () => {
    preview.innerHTML = '';
    const file = input.files[0];
    if (file) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = 'معاينة الصورة';
      preview.appendChild(img);
    }
  });
}
bindImagePreview('ev-image', 'ev-image-preview');
bindImagePreview('ar-image', 'ar-image-preview');

// ================= التبويبات =================
document.querySelectorAll('.admin-tabs .filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tabs .filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('events-tab').classList.toggle('hidden', btn.dataset.tab !== 'events-tab');
    document.getElementById('articles-tab').classList.toggle('hidden', btn.dataset.tab !== 'articles-tab');
  });
});

// ================= الفعاليات =================
let editingEventImageUrl = null;

async function loadAdminEvents() {
  const list = document.getElementById('admin-events-list');
  const { data, error } = await sb.from('events').select('*').order('event_date', { ascending: false });
  if (error) {
    list.innerHTML = '<div class="empty-state">تعذّر التحميل.</div>';
    console.error(error);
    return;
  }
  if (!data.length) {
    list.innerHTML = '<div class="empty-state">ما فيه فعاليات بعد — أضف أول فعالية من النموذج فوق.</div>';
    return;
  }
  list.innerHTML = '';
  data.forEach((ev) => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    const st = effectiveStatus(ev);
    item.innerHTML = `
      ${ev.image_url ? `<img class="thumb" src="${escapeHtml(ev.image_url)}" alt="" />` : '<div class="thumb"></div>'}
      <div class="meta">
        <strong>${escapeHtml(ev.title)}</strong>
        <span class="num">${formatDateAr(ev.event_date)}</span> ·
        <span>${escapeHtml(ev.location || '')}</span> ·
        <span class="tag ${st === 'upcoming' ? 'tag-upcoming' : 'tag-past'}">${st === 'upcoming' ? 'قادمة' : 'منتهية'}</span>
      </div>
      <div class="actions"></div>`;
    const actions = item.querySelector('.actions');

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-ghost btn-sm';
    editBtn.textContent = 'تعديل';
    editBtn.addEventListener('click', () => startEditEvent(ev));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-sm';
    delBtn.textContent = 'حذف';
    delBtn.addEventListener('click', () => deleteEvent(ev));

    actions.append(editBtn, delBtn);
    list.appendChild(item);
  });
}

function startEditEvent(ev) {
  document.getElementById('event-id').value = ev.id;
  document.getElementById('ev-title').value = ev.title || '';
  document.getElementById('ev-date').value = ev.event_date || '';
  document.getElementById('ev-location').value = ev.location || '';
  document.getElementById('ev-status').value = ev.status === 'past' ? 'past' : 'upcoming';
  document.getElementById('ev-desc').value = ev.description || '';
  document.getElementById('ev-image').value = '';
  document.getElementById('ev-image-preview').innerHTML = ev.image_url
    ? `<img src="${escapeHtml(ev.image_url)}" alt="الصورة الحالية" />`
    : '';
  editingEventImageUrl = ev.image_url || null;
  document.getElementById('event-form-title').textContent = 'تعديل الفعالية';
  document.getElementById('ev-cancel').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetEventForm() {
  ['event-id', 'ev-title', 'ev-date', 'ev-location', 'ev-desc'].forEach((id) => (document.getElementById(id).value = ''));
  document.getElementById('ev-status').value = 'upcoming';
  document.getElementById('ev-image').value = '';
  document.getElementById('ev-image-preview').innerHTML = '';
  editingEventImageUrl = null;
  document.getElementById('event-form-title').textContent = 'إضافة فعالية جديدة';
  document.getElementById('ev-cancel').classList.add('hidden');
}

document.getElementById('ev-cancel').addEventListener('click', resetEventForm);

document.getElementById('ev-save').addEventListener('click', async () => {
  const id = document.getElementById('event-id').value;
  const title = document.getElementById('ev-title').value.trim();
  const event_date = document.getElementById('ev-date').value;
  const location = document.getElementById('ev-location').value.trim();
  const status = document.getElementById('ev-status').value;
  const description = document.getElementById('ev-desc').value.trim();
  const file = document.getElementById('ev-image').files[0];

  if (!title || !event_date) {
    showAlert(adminAlert, 'العنوان والتاريخ مطلوبان.');
    return;
  }

  const btn = document.getElementById('ev-save');
  btn.disabled = true;
  btn.textContent = 'جارٍ الحفظ…';

  try {
    let image_url = editingEventImageUrl;
    if (file) image_url = await uploadImage(file, 'events');

    const payload = { title, event_date, location, status, description, image_url };
    let error;
    if (id) {
      ({ error } = await sb.from('events').update(payload).eq('id', id));
    } else {
      ({ error } = await sb.from('events').insert(payload));
    }
    if (error) throw error;

    showAlert(adminAlert, id ? 'تم تحديث الفعالية.' : 'تمت إضافة الفعالية.', true);
    resetEventForm();
    loadAdminEvents();
  } catch (err) {
    console.error(err);
    showAlert(adminAlert, 'صار خطأ أثناء الحفظ. تأكد من إنشاء حاوية الصور وصلاحيات الجدول ثم أعد المحاولة.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'حفظ الفعالية';
  }
});

async function deleteEvent(ev) {
  if (!confirm(`متأكد من حذف الفعالية «${ev.title}»؟ الحذف نهائي.`)) return;
  const { error } = await sb.from('events').delete().eq('id', ev.id);
  if (error) {
    console.error(error);
    showAlert(adminAlert, 'تعذّر الحذف. أعد المحاولة.');
    return;
  }
  showAlert(adminAlert, 'تم حذف الفعالية.', true);
  loadAdminEvents();
}

// ================= المقالات =================
let editingArticleImageUrl = null;

async function loadAdminArticles() {
  const list = document.getElementById('admin-articles-list');
  const { data, error } = await sb.from('articles').select('*').order('published_at', { ascending: false });
  if (error) {
    list.innerHTML = '<div class="empty-state">تعذّر التحميل — تأكد من إنشاء جدول المقالات (راجع supabase_setup.sql).</div>';
    console.error(error);
    return;
  }
  if (!data.length) {
    list.innerHTML = '<div class="empty-state">ما فيه مقالات بعد.</div>';
    return;
  }
  list.innerHTML = '';
  data.forEach((a) => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    const dateStr = a.published_at ? formatDateAr(String(a.published_at).slice(0, 10)) : '';
    item.innerHTML = `
      ${a.image_url ? `<img class="thumb" src="${escapeHtml(a.image_url)}" alt="" />` : '<div class="thumb"></div>'}
      <div class="meta">
        <strong>${escapeHtml(a.title)}</strong>
        <span class="num">${dateStr}</span>
      </div>
      <div class="actions"></div>`;
    const actions = item.querySelector('.actions');

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-ghost btn-sm';
    editBtn.textContent = 'تعديل';
    editBtn.addEventListener('click', () => startEditArticle(a));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-sm';
    delBtn.textContent = 'حذف';
    delBtn.addEventListener('click', () => deleteArticle(a));

    actions.append(editBtn, delBtn);
    list.appendChild(item);
  });
}

function startEditArticle(a) {
  document.getElementById('article-id').value = a.id;
  document.getElementById('ar-title').value = a.title || '';
  document.getElementById('ar-content').value = a.content || '';
  document.getElementById('ar-image').value = '';
  document.getElementById('ar-image-preview').innerHTML = a.image_url
    ? `<img src="${escapeHtml(a.image_url)}" alt="الصورة الحالية" />`
    : '';
  editingArticleImageUrl = a.image_url || null;
  document.getElementById('article-form-title').textContent = 'تعديل المقال';
  document.getElementById('ar-cancel').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetArticleForm() {
  ['article-id', 'ar-title', 'ar-content'].forEach((id) => (document.getElementById(id).value = ''));
  document.getElementById('ar-image').value = '';
  document.getElementById('ar-image-preview').innerHTML = '';
  editingArticleImageUrl = null;
  document.getElementById('article-form-title').textContent = 'إضافة مقال جديد';
  document.getElementById('ar-cancel').classList.add('hidden');
}

document.getElementById('ar-cancel').addEventListener('click', resetArticleForm);

document.getElementById('ar-save').addEventListener('click', async () => {
  const id = document.getElementById('article-id').value;
  const title = document.getElementById('ar-title').value.trim();
  const content = document.getElementById('ar-content').value.trim();
  const file = document.getElementById('ar-image').files[0];

  if (!title || !content) {
    showAlert(adminAlert, 'العنوان والمحتوى مطلوبان.');
    return;
  }

  const btn = document.getElementById('ar-save');
  btn.disabled = true;
  btn.textContent = 'جارٍ النشر…';

  try {
    let image_url = editingArticleImageUrl;
    if (file) image_url = await uploadImage(file, 'articles');

    const payload = { title, content, image_url };
    let error;
    if (id) {
      ({ error } = await sb.from('articles').update(payload).eq('id', id));
    } else {
      payload.published_at = new Date().toISOString();
      ({ error } = await sb.from('articles').insert(payload));
    }
    if (error) throw error;

    showAlert(adminAlert, id ? 'تم تحديث المقال.' : 'تم نشر المقال.', true);
    resetArticleForm();
    loadAdminArticles();
  } catch (err) {
    console.error(err);
    showAlert(adminAlert, 'صار خطأ أثناء النشر. تأكد من إنشاء جدول المقالات وحاوية الصور ثم أعد المحاولة.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'نشر المقال';
  }
});

async function deleteArticle(a) {
  if (!confirm(`متأكد من حذف المقال «${a.title}»؟ الحذف نهائي.`)) return;
  const { error } = await sb.from('articles').delete().eq('id', a.id);
  if (error) {
    console.error(error);
    showAlert(adminAlert, 'تعذّر الحذف. أعد المحاولة.');
    return;
  }
  showAlert(adminAlert, 'تم حذف المقال.', true);
  loadAdminArticles();
}

// بدء التشغيل
refreshAuthUI();
