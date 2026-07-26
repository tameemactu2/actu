// بناء معرض صور منزلق (slider) من قائمة روابط
// يرجّع HTML للحاوية، ويربط الأزرار بعد الإدراج عبر initGallery
function galleryHtml(images) {
  if (!images || !images.length) return '';
  if (images.length === 1) {
    return `<img class="detail-hero-img" src="${escapeHtml(images[0])}" alt="" />`;
  }
  const slides = images
    .map((url) => `<div class="gallery-slide"><img src="${escapeHtml(url)}" alt="" /></div>`)
    .join('');
  const dots = images
    .map((_, i) => `<button class="gallery-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="صورة ${i + 1}"></button>`)
    .join('');
  return `
    <div class="gallery" id="gallery">
      <div class="gallery-counter num"><span id="gallery-cur">1</span>/${images.length}</div>
      <div class="gallery-track" id="gallery-track">${slides}</div>
      <button class="gallery-btn prev" id="gallery-prev" aria-label="السابق">›</button>
      <button class="gallery-btn next" id="gallery-next" aria-label="التالي">‹</button>
      <div class="gallery-dots">${dots}</div>
    </div>`;
}

function initGallery(count) {
  if (!count || count < 2) return;
  const track = document.getElementById('gallery-track');
  const dots = document.querySelectorAll('.gallery-dot');
  const cur = document.getElementById('gallery-cur');
  let idx = 0;

  function go(n) {
    idx = (n + count) % count;
    track.style.transform = `translateX(${idx * 100}%)`; // RTL: موجب يحرّك يمين
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    if (cur) cur.textContent = idx + 1;
  }

  document.getElementById('gallery-next').addEventListener('click', () => go(idx + 1));
  document.getElementById('gallery-prev').addEventListener('click', () => go(idx - 1));
  dots.forEach((d) => d.addEventListener('click', () => go(parseInt(d.dataset.i, 10))));

  // سحب باللمس
  let startX = null;
  track.addEventListener('touchstart', (e) => (startX = e.touches[0].clientX), { passive: true });
  track.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) go(dx > 0 ? idx - 1 : idx + 1); // RTL: سحب لليمين = السابق
    startX = null;
  }, { passive: true });
}
