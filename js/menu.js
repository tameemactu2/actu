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
  links.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
})();
