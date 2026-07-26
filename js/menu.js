// قائمة الهمبرغر (الجوال) — مشتركة بين الصفحات
(function () {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  const backdrop = document.getElementById('nav-backdrop');
  if (!toggle || !links) return;

  function openMenu() {
    links.classList.add('open');
    if (backdrop) backdrop.classList.add('show');
    toggle.classList.add('active');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    links.classList.remove('open');
    if (backdrop) backdrop.classList.remove('show');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => {
    if (links.classList.contains('open')) closeMenu();
    else openMenu();
  });
  if (backdrop) backdrop.addEventListener('click', closeMenu);

  // عند الضغط على رابط: نقفل القائمة، ونترك المتصفح ينتقل للرابط
  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href') || '';
      // نقفل الشكل بس بدون منع الانتقال
      closeMenu();
      // لو الرابط لقسم بنفس الصفحة (#...) ننزّل له يدوياً بعد الإغلاق
      if (href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      }
      // روابط الصفحات (index.html, about.html …) تشتغل عادي — ما نمنعها
    });
  });
})();
