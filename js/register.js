// زر التسجيل — يقرأ النص والرابط والحالة من جدول site_content
// أي عنصر فيه السمة data-register-btn يتعبّى تلقائياً في أي صفحة
(async function () {
  const els = document.querySelectorAll('[data-register-btn]');
  if (!els.length) return;

  const c = await loadSiteContent(['register_url', 'register_label', 'register_enabled']);

  const url = (c.register_url || '').trim();
  const label = (c.register_label || '').trim() || 'سجّل معنا';
  const enabled = c.register_enabled !== '0' && /^https?:\/\//i.test(url);

  els.forEach((el) => {
    if (!enabled) {
      el.remove(); // ما فيه رابط أو الزر مقفول → ما يظهر أصلاً
      return;
    }
    el.textContent = label;
    el.setAttribute('href', url);
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer');
    el.removeAttribute('hidden');
  });
})();
