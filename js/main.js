// الصفحة العامة: قراءة الفعاليات والمقالات من Supabase (قراءة فقط للزوار)

let allEvents = [];
let currentFilter = 'all';

const eventsGrid = document.getElementById('events-grid');
const articlesGrid = document.getElementById('articles-grid');

async function loadEvents() {
  const { data, error } = await sb
    .from('events')
    .select('*')
    .order('event_date', { ascending: false });

  if (error) {
    eventsGrid.innerHTML = `<div class="empty-state">تعذّر تحميل الفعاليات حالياً. حاول تحديث الصفحة.</div>`;
    console.error(error);
    return;
  }
  allEvents = data || [];
  renderEvents();
}

let eventsExpanded = false;
const EVENTS_LIMIT = 3;

function eventCardHtml(ev) {
  const st = effectiveStatus(ev);
  const tag =
    st === 'upcoming'
      ? '<span class="tag tag-upcoming">قادمة</span>'
      : '<span class="tag tag-past">منتهية</span>';
  const img = ev.image_url
    ? `<img src="${escapeHtml(ev.image_url)}" alt="${escapeHtml(ev.title)}" loading="lazy" />`
    : `<div class="img-fallback"><img src="assets/mark.png" alt="" /></div>`;
  return `
      <a class="card-link" href="event.html?id=${encodeURIComponent(ev.id)}">
      <article class="event-card">
        <div class="event-img">${img}</div>
        <div class="event-body">
          <div class="event-top">
            ${tag}
            <span class="event-date num">📅 ${formatDateAr(ev.event_date)}</span>
          </div>
          <h3>${escapeHtml(ev.title)}</h3>
          <p>${escapeHtml(stripHtml(ev.description).slice(0, 120))}${stripHtml(ev.description).length > 120 ? '…' : ''}</p>
          ${ev.location ? `<div class="event-loc">📍 ${escapeHtml(ev.location)}</div>` : ''}
        </div>
      </article>
      </a>`;
}

function renderEvents() {
  const list = allEvents.filter((ev) => {
    if (currentFilter === 'all') return true;
    return effectiveStatus(ev) === currentFilter;
  });

  if (!list.length) {
    const msg =
      currentFilter === 'upcoming'
        ? 'ما فيه فعاليات قادمة حالياً — تابعنا، الجديد قريب.'
        : currentFilter === 'past'
          ? 'ما فيه فعاليات منتهية بعد.'
          : 'ما أضيفت فعاليات بعد.';
    eventsGrid.innerHTML = `<div class="empty-state">${msg}</div>`;
    const mb = document.getElementById('events-more');
    if (mb) mb.innerHTML = '';
    return;
  }

  const shown = eventsExpanded ? list : list.slice(0, EVENTS_LIMIT);
  eventsGrid.innerHTML = shown.map(eventCardHtml).join('');

  const moreWrap = document.getElementById('events-more');
  if (moreWrap) {
    if (list.length > EVENTS_LIMIT) {
      moreWrap.innerHTML = `<button class="btn btn-outline-teal show-more-btn">${eventsExpanded ? 'عرض أقل' : 'عرض المزيد'}</button>`;
      moreWrap.querySelector('button').addEventListener('click', () => {
        eventsExpanded = !eventsExpanded;
        renderEvents();
        if (!eventsExpanded) document.getElementById('events').scrollIntoView({ behavior: 'smooth' });
      });
    } else {
      moreWrap.innerHTML = '';
    }
  }
}

document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    eventsExpanded = false;
    renderEvents();
  });
});

let allArticles = [];
let articlesExpanded = false;
const ARTICLES_LIMIT = 3;

async function loadArticles() {
  const { data, error } = await sb
    .from('articles')
    .select('*')
    .order('published_at', { ascending: false });

  if (error || !data || !data.length) {
    articlesGrid.innerHTML = `<div class="empty-state" style="color: rgba(244,244,241,0.6);">ما نُشرت مقالات بعد.</div>`;
    if (error) console.error(error);
    return;
  }
  allArticles = data;
  renderArticles();
}

function articleCardHtml(a) {
  const img = a.image_url
    ? `<img src="${escapeHtml(a.image_url)}" alt="${escapeHtml(a.title)}" loading="lazy" />`
    : `<div class="img-fallback"><img src="assets/mark.png" alt="" /></div>`;
  const plain = stripHtml(a.content);
  const excerpt = plain.slice(0, 140) + (plain.length > 140 ? '…' : '');
  const dateStr = a.published_at ? formatDateAr(String(a.published_at).slice(0, 10)) : '';
  return `
      <a class="card-link" href="article.html?id=${encodeURIComponent(a.id)}">
      <article class="article-card">
        <div class="event-img">${img}</div>
        <div class="article-body">
          <h3>${escapeHtml(a.title)}</h3>
          <p>${escapeHtml(excerpt)}</p>
          ${dateStr ? `<time class="num">${dateStr}</time>` : ''}
        </div>
      </article>
      </a>`;
}

function renderArticles() {
  const shown = articlesExpanded ? allArticles : allArticles.slice(0, ARTICLES_LIMIT);
  articlesGrid.innerHTML = shown.map(articleCardHtml).join('');

  const moreWrap = document.getElementById('articles-more');
  if (moreWrap) {
    if (allArticles.length > ARTICLES_LIMIT) {
      moreWrap.innerHTML = `<button class="btn btn-outline-mint show-more-btn">${articlesExpanded ? 'عرض أقل' : 'عرض المزيد'}</button>`;
      moreWrap.querySelector('button').addEventListener('click', () => {
        articlesExpanded = !articlesExpanded;
        renderArticles();
        if (!articlesExpanded) document.getElementById('articles').scrollIntoView({ behavior: 'smooth' });
      });
    } else {
      moreWrap.innerHTML = '';
    }
  }
}

loadEvents();
loadArticles();

// إخفاء الناف بار عند النزول، وإظهاره عند الصعود
(function () {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  let lastY = window.scrollY;
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    // تجاهل الحركة البسيطة
    if (Math.abs(y - lastY) < 6) {
      ticking = false;
      return;
    }
    if (y > lastY && y > 80) {
      navbar.classList.add('nav-hidden'); // نازل
    } else {
      navbar.classList.remove('nav-hidden'); // طالع
    }
    lastY = y;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
})();
