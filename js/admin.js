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
const allTabs = ['events-tab', 'articles-tab', 'site-tab'];
document.querySelectorAll('.admin-tabs .filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tabs .filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    allTabs.forEach((t) => {
      const el = document.getElementById(t);
      if (el) el.classList.toggle('hidden', t !== btn.dataset.tab);
    });
    if (btn.dataset.tab === 'site-tab') loadSiteTab();
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

// ================= المعاينة قبل النشر =================
function previewImages(existingUrls, pendingFiles) {
  // روابط الصور الموجودة + معاينة الملفات الجديدة (blob) بالترتيب
  const urls = (existingUrls || []).slice();
  (pendingFiles || []).forEach((f) => urls.push(URL.createObjectURL(f)));
  return urls;
}

function openPreview(html) {
  const modal = document.getElementById('preview-modal');
  document.getElementById('preview-content').innerHTML = html;
  // فعّل السلايدر لو فيه معرض
  const track = document.getElementById('gallery-track');
  if (track) initGallery(track.querySelectorAll('.gallery-slide').length);
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closePreview() {
  document.getElementById('preview-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('preview-close').addEventListener('click', closePreview);
document.getElementById('preview-close-bg').addEventListener('click', closePreview);

// معاينة الفعالية
document.getElementById('ev-preview').addEventListener('click', () => {
  const title = document.getElementById('ev-title').value.trim() || '(بدون عنوان)';
  const event_date = document.getElementById('ev-date').value;
  const location = document.getElementById('ev-location').value.trim();
  const status = document.getElementById('ev-status').value;
  const description = (evEditor && evEditor.getText().trim()) ? evEditor.root.innerHTML : '';
  const images = previewImages(editingEventImages, pendingEventFiles);

  const st = status === 'past' ? 'past' : 'upcoming';
  const tag = st === 'upcoming'
    ? '<span class="tag tag-upcoming">قادمة</span>'
    : '<span class="tag tag-past">منتهية</span>';

  const html = `
    ${galleryHtml(images)}
    <div class="detail-meta">${tag}</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="detail-sub">
      ${event_date ? `<span class="num">📅 ${formatDateAr(event_date)}</span>` : ''}
      ${location ? `<span>📍 ${escapeHtml(location)}</span>` : ''}
    </div>
    <div class="detail-content rich-content">${description}</div>`;
  openPreview(html);
});

// معاينة المقال
document.getElementById('ar-preview').addEventListener('click', () => {
  const title = document.getElementById('ar-title').value.trim() || '(بدون عنوان)';
  const content = (arEditor && arEditor.getText().trim()) ? arEditor.root.innerHTML : '';
  const images = previewImages(editingArticleImages, pendingArticleFiles);
  const dateStr = formatDateAr(new Date().toISOString().slice(0, 10));

  const html = `
    ${galleryHtml(images)}
    <h1>${escapeHtml(title)}</h1>
    <div class="detail-sub"><span class="num">📅 ${dateStr}</span></div>
    <div class="detail-content rich-content">${content}</div>`;
  openPreview(html);
});

// ================= محتوى الموقع =================

// مفتاح → عنصر الإدخال
const SC_FIELDS = {
  hero_eyebrow:    'sc-hero-eyebrow',
  hero_title:      'sc-hero-title',
  hero_en:         'sc-hero-en',
  hero_tagline:    'sc-hero-tagline',
  about_text:      'sc-about-text',
  about_vision:    'sc-about-vision',
  about_mission:   'sc-about-mission',
  footer_x:        'sc-footer-x',
  footer_linkedin: 'sc-footer-linkedin',
  footer_email:    'sc-footer-email',
};

let siteTabLoaded = false;

// القيم الافتراضية — تظهر لو الجدول ما موجود بعد أو فاضي
const SC_DEFAULTS = {
  hero_eyebrow:    'نادٍ طلابي · جامعة الملك سعود',
  hero_title:      'نادي العلوم الاكتوارية',
  hero_en:         'Actuarial Science Club — King Saud University',
  hero_tagline:    'نحو مستقبل اكتواري مستدام',
  about_text:      'نادي العلوم الاكتوارية نادٍ طلابي في جامعة الملك سعود، يهدف إلى ربط طلبة الرياضيات الاكتوارية والمالية بسوق العمل: من الاختبارات المهنية إلى التحليل المالي وإدارة المخاطر. نبني هذا الطريق عبر ورش عمل تطبيقية، ولقاءات مع اكتواريين ممارسين، ومسابقات معرفية تصقل مهارات الأعضاء وتوسّع شبكة علاقاتهم المهنية.',
  about_vision:    'أن يكون النادي المرجع الطلابي الرائد في العلوم الاكتوارية على مستوى الجامعات السعودية.',
  about_mission:   'تطوير الطالب الاكتواري مهنياً وتهيئته لسوق العمل: التوعية بالتخصص، ولقاءات مع اكتواريين ممارسين، وزيارات ميدانية لجهات تنظيمية وخدمية، وورشٌ وندوات، وبناء شبكة علاقات فاعلة بين الأعضاء.',
  about_values:    '["الاحترافية","الابتكار","الانتماء","التعاون","المبادرة","المسؤولية"]',
  about_cards:     '[{"title":"ورش عمل","text":"ورش تطبيقية في الاختبارات المهنية والأدوات الاكتوارية والمالية."},{"title":"لقاءات مهنية","text":"جلسات مع اكتواريين ممارسين وزيارات ميدانية لجهات تنظيمية وخدمية."},{"title":"مسابقات معرفية","text":"منافسات تحفّز الطلبة وتعمّق فهمهم للتخصص وتطبيقاته."}]',
  about_goals:     '[{"title":"نشر الوعي بتخصص العلوم الاكتوارية","text":"من خلال اللقاءات وصفحات التواصل الاجتماعي."},{"title":"رفع جاهزية الطلبة لسوق العمل","text":"من خلال الزيارات الميدانية وورش العمل."},{"title":"دعم الطلبة للاستعداد للاختبارات المهنية","text":"من خلال الشراكات مع الجهات والمنصّات المتخصصة في التحضير للاختبارات."},{"title":"تعزيز البحث العلمي والمهني في العلوم الاكتوارية","text":"من خلال بناء المشاريع البحثية أو التقارير."},{"title":"تعزيز الترابط وبناء شبكة علاقات بين الطلاب الاكتواريين","text":"من خلال نشر روح العمل الجماعي وخلال اللقاءات."}]',
  footer_x:        '#',
  footer_linkedin: '#',
  footer_email:    'afmclub.ksu@gmail.com',
};

async function loadSiteTab() {
  if (siteTabLoaded) return;
  const keys = Object.keys(SC_FIELDS).concat(['about_values', 'about_cards', 'about_goals']);
  let c = await loadSiteContent(keys);

  // دمج: لو القيمة ما جت من القاعدة، نستخدم الافتراضية
  keys.forEach((k) => { if (c[k] == null && SC_DEFAULTS[k] != null) c[k] = SC_DEFAULTS[k]; });

  // حقول نصية بسيطة
  Object.entries(SC_FIELDS).forEach(([key, elId]) => {
    const el = document.getElementById(elId);
    if (el && c[key] != null) el.value = c[key];
  });

  // القيم (مصفوفة → نص بفواصل)
  if (c.about_values) {
    try {
      document.getElementById('sc-about-values').value = JSON.parse(c.about_values).join('، ');
    } catch (e) {}
  }

  // البطاقات
  if (c.about_cards) {
    try { renderCards(JSON.parse(c.about_cards)); } catch (e) {}
  }

  // الأهداف
  if (c.about_goals) {
    try { renderGoals(JSON.parse(c.about_goals)); } catch (e) {}
  }

  siteTabLoaded = true;
}

// ---------- بطاقات ديناميكية ----------
let scCards = [];

function renderCards(arr) {
  scCards = arr || [];
  const list = document.getElementById('sc-cards-list');
  list.innerHTML = '';
  scCards.forEach((card, i) => {
    const row = document.createElement('div');
    row.className = 'form-row';
    row.style.alignItems = 'flex-end';
    row.innerHTML = `
      <div class="field" style="flex:1">
        <label>عنوان البطاقة ${i + 1}</label>
        <input type="text" class="sc-card-title" data-i="${i}" value="${escapeHtml(card.title)}" />
      </div>
      <div class="field" style="flex:2">
        <label>النص</label>
        <input type="text" class="sc-card-text" data-i="${i}" value="${escapeHtml(card.text)}" />
      </div>
      <button class="btn btn-danger btn-sm sc-card-del" data-i="${i}" style="margin-bottom:12px;" type="button">حذف</button>`;
    list.appendChild(row);
  });
  list.querySelectorAll('.sc-card-title').forEach((el) => el.addEventListener('input', () => { scCards[el.dataset.i].title = el.value; }));
  list.querySelectorAll('.sc-card-text').forEach((el) => el.addEventListener('input', () => { scCards[el.dataset.i].text = el.value; }));
  list.querySelectorAll('.sc-card-del').forEach((el) => el.addEventListener('click', () => { scCards.splice(el.dataset.i, 1); renderCards(scCards); }));
}

document.getElementById('sc-add-card').addEventListener('click', () => {
  scCards.push({ title: '', text: '' });
  renderCards(scCards);
});

// ---------- أهداف ديناميكية ----------
let scGoals = [];

function renderGoals(arr) {
  scGoals = arr || [];
  const list = document.getElementById('sc-goals-list');
  list.innerHTML = '';
  scGoals.forEach((goal, i) => {
    const row = document.createElement('div');
    row.className = 'form-row';
    row.style.alignItems = 'flex-end';
    row.innerHTML = `
      <div class="field" style="flex:1">
        <label>هدف ${i + 1}</label>
        <input type="text" class="sc-goal-title" data-i="${i}" value="${escapeHtml(goal.title)}" />
      </div>
      <div class="field" style="flex:2">
        <label>آلية التحقيق</label>
        <input type="text" class="sc-goal-text" data-i="${i}" value="${escapeHtml(goal.text)}" />
      </div>
      <button class="btn btn-danger btn-sm sc-goal-del" data-i="${i}" style="margin-bottom:12px;" type="button">حذف</button>`;
    list.appendChild(row);
  });
  list.querySelectorAll('.sc-goal-title').forEach((el) => el.addEventListener('input', () => { scGoals[el.dataset.i].title = el.value; }));
  list.querySelectorAll('.sc-goal-text').forEach((el) => el.addEventListener('input', () => { scGoals[el.dataset.i].text = el.value; }));
  list.querySelectorAll('.sc-goal-del').forEach((el) => el.addEventListener('click', () => { scGoals.splice(el.dataset.i, 1); renderGoals(scGoals); }));
}

document.getElementById('sc-add-goal').addEventListener('click', () => {
  scGoals.push({ title: '', text: '' });
  renderGoals(scGoals);
});

// ---------- حفظ جميع محتوى الموقع ----------
document.getElementById('sc-save').addEventListener('click', async () => {
  const btn = document.getElementById('sc-save');
  btn.disabled = true;
  btn.textContent = 'جارٍ الحفظ…';

  try {
    // تجميع القيم
    const valuesInput = document.getElementById('sc-about-values').value;
    const valuesArr = valuesInput.split(/[،,]/).map((v) => v.trim()).filter(Boolean);

    const rows = [];
    Object.entries(SC_FIELDS).forEach(([key, elId]) => {
      rows.push({ key, value: document.getElementById(elId).value.trim() });
    });
    rows.push({ key: 'about_values', value: JSON.stringify(valuesArr) });
    rows.push({ key: 'about_cards', value: JSON.stringify(scCards) });
    rows.push({ key: 'about_goals', value: JSON.stringify(scGoals) });

    // حفظ كل مفتاح على حدة (update لو موجود، insert لو ما موجود)
    for (const row of rows) {
      const { data: existing } = await sb.from('site_content').select('key').eq('key', row.key).single();
      let error;
      if (existing) {
        ({ error } = await sb.from('site_content').update({ value: row.value }).eq('key', row.key));
      } else {
        ({ error } = await sb.from('site_content').insert(row));
      }
      if (error) throw error;
    }

    showAlert(adminAlert, 'تم حفظ محتوى الموقع بنجاح.', true);
  } catch (err) {
    console.error(err);
    showAlert(adminAlert, 'تعذّر الحفظ. تأكد من إنشاء جدول site_content وصلاحياته.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'حفظ جميع التعديلات';
  }
});

// بدء التشغيل
refreshAuthUI();
