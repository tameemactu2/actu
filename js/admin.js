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

// ================= المحرر الغني (Quill) =================
const editorToolbar = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  ['link', 'image'],
  ['clean'],
];

function makeEditor(selector, folder) {
  const quill = new Quill(selector, {
    theme: 'snow',
    modules: { toolbar: editorToolbar },
    placeholder: 'اكتب المحتوى هنا… تقدر تضيف عناوين وصور بين الفقرات.',
  });
  // رفع الصورة داخل النص إلى Supabase بدل ما تنحفظ base64
  quill.getModule('toolbar').addHandler('image', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const range = quill.getSelection(true);
      quill.insertText(range.index, ' جارٍ رفع الصورة… ');
      try {
        const url = await uploadImage(file, folder);
        quill.deleteText(range.index, ' جارٍ رفع الصورة… '.length);
        quill.insertEmbed(range.index, 'image', url);
        quill.setSelection(range.index + 1);
      } catch (err) {
        console.error(err);
        quill.deleteText(range.index, ' جارٍ رفع الصورة… '.length);
        showAlert(adminAlert, 'تعذّر رفع الصورة داخل النص.');
      }
    };
    input.click();
  });
  return quill;
}

let evEditor = null;
let arEditor = null;
function initEditors() {
  if (!evEditor) evEditor = makeEditor('#ev-editor', 'events');
  if (!arEditor) arEditor = makeEditor('#ar-editor', 'articles');
}

// ================= المصادقة =================
async function refreshAuthUI() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    loginView.classList.add('hidden');
    adminView.classList.remove('hidden');
    initEditors();
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

// رفع عدة صور، يرجّع قائمة روابط بالترتيب
async function uploadImages(files, folder) {
  const urls = [];
  for (const file of files) {
    urls.push(await uploadImage(file, folder));
  }
  return urls;
}

// معاينة الصور: الموجودة (روابط) + الجديدة (ملفات)، مع زر حذف لكل صورة
function renderPreview(previewEl, pendingFiles, existingUrls, onRemoveExisting, onRemovePending) {
  previewEl.innerHTML = '';
  (existingUrls || []).forEach((url, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'preview-item';
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'صورة حالية';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preview-remove';
    btn.textContent = '×';
    btn.title = 'حذف الصورة';
    btn.addEventListener('click', () => onRemoveExisting(i));
    wrap.append(img, btn);
    previewEl.appendChild(wrap);
  });
  (pendingFiles || []).forEach((file, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'preview-item';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = 'صورة جديدة';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preview-remove';
    btn.textContent = '×';
    btn.title = 'حذف الصورة';
    btn.addEventListener('click', () => onRemovePending(i));
    wrap.append(img, btn);
    previewEl.appendChild(wrap);
  });
}

// حالة الصور لكل نموذج
let editingEventImages = [];   // روابط موجودة
let pendingEventFiles = [];    // ملفات جديدة لم تُرفع بعد
let editingArticleImages = [];
let pendingArticleFiles = [];

function refreshEventPreview() {
  renderPreview(
    document.getElementById('ev-image-preview'),
    pendingEventFiles,
    editingEventImages,
    (i) => { editingEventImages.splice(i, 1); refreshEventPreview(); },
    (i) => { pendingEventFiles.splice(i, 1); refreshEventPreview(); }
  );
}

function refreshArticlePreview() {
  renderPreview(
    document.getElementById('ar-image-preview'),
    pendingArticleFiles,
    editingArticleImages,
    (i) => { editingArticleImages.splice(i, 1); refreshArticlePreview(); },
    (i) => { pendingArticleFiles.splice(i, 1); refreshArticlePreview(); }
  );
}

// عند اختيار ملفات: تُضاف للقائمة بدل ما تستبدلها
document.getElementById('ev-image').addEventListener('change', (e) => {
  pendingEventFiles = pendingEventFiles.concat(Array.from(e.target.files));
  e.target.value = ''; // يسمح باختيار نفس الملف مرة ثانية لو حُذف
  refreshEventPreview();
});

document.getElementById('ar-image').addEventListener('change', (e) => {
  pendingArticleFiles = pendingArticleFiles.concat(Array.from(e.target.files));
  e.target.value = '';
  refreshArticlePreview();
});

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
  if (evEditor) evEditor.root.innerHTML = ev.description || '';
  document.getElementById('ev-image').value = '';
  editingEventImages = ev.images && ev.images.length ? ev.images.slice() : (ev.image_url ? [ev.image_url] : []);
  pendingEventFiles = [];
  refreshEventPreview();
  document.getElementById('event-form-title').textContent = 'تعديل الفعالية';
  document.getElementById('ev-cancel').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetEventForm() {
  ['event-id', 'ev-title', 'ev-date', 'ev-location'].forEach((id) => (document.getElementById(id).value = ''));
  document.getElementById('ev-status').value = 'upcoming';
  if (evEditor) evEditor.root.innerHTML = '';
  document.getElementById('ev-image').value = '';
  document.getElementById('ev-image-preview').innerHTML = '';
  editingEventImages = [];
  pendingEventFiles = [];
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
  const description = (evEditor && evEditor.getText().trim()) ? evEditor.root.innerHTML : '';

  if (!title || !event_date) {
    showAlert(adminAlert, 'العنوان والتاريخ مطلوبان.');
    return;
  }

  const btn = document.getElementById('ev-save');
  btn.disabled = true;
  btn.textContent = 'جارٍ الحفظ…';

  try {
    // الصور الموجودة + الصور الجديدة المرفوعة
    let images = editingEventImages.slice();
    if (pendingEventFiles.length) {
      const newUrls = await uploadImages(pendingEventFiles, 'events');
      images = images.concat(newUrls);
    }
    const image_url = images[0] || null; // أول صورة = صورة الغلاف

    const payload = { title, event_date, location, status, description, image_url, images };
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
  if (arEditor) arEditor.root.innerHTML = a.content || '';
  document.getElementById('ar-image').value = '';
  editingArticleImages = a.images && a.images.length ? a.images.slice() : (a.image_url ? [a.image_url] : []);
  pendingArticleFiles = [];
  refreshArticlePreview();
  document.getElementById('article-form-title').textContent = 'تعديل المقال';
  document.getElementById('ar-cancel').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetArticleForm() {
  ['article-id', 'ar-title'].forEach((id) => (document.getElementById(id).value = ''));
  if (arEditor) arEditor.root.innerHTML = '';
  document.getElementById('ar-image').value = '';
  document.getElementById('ar-image-preview').innerHTML = '';
  editingArticleImages = [];
  pendingArticleFiles = [];
  document.getElementById('article-form-title').textContent = 'إضافة مقال جديد';
  document.getElementById('ar-cancel').classList.add('hidden');
}

document.getElementById('ar-cancel').addEventListener('click', resetArticleForm);

document.getElementById('ar-save').addEventListener('click', async () => {
  const id = document.getElementById('article-id').value;
  const title = document.getElementById('ar-title').value.trim();
  const content = (arEditor && arEditor.getText().trim()) ? arEditor.root.innerHTML : '';

  if (!title || !content) {
    showAlert(adminAlert, 'العنوان والمحتوى مطلوبان.');
    return;
  }

  const btn = document.getElementById('ar-save');
  btn.disabled = true;
  btn.textContent = 'جارٍ النشر…';

  try {
    let images = editingArticleImages.slice();
    if (pendingArticleFiles.length) {
      const newUrls = await uploadImages(pendingArticleFiles, 'articles');
      images = images.concat(newUrls);
    }
    const image_url = images[0] || null;

    const payload = { title, content, image_url, images };
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
