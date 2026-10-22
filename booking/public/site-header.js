// Menú común: en pantallas pequeñas se pliega tras el botón "Menú".
(() => {
  const header = document.querySelector('.site-header');
  const toggle = header && header.querySelector('.sh-toggle');
  const nav = header && header.querySelector('.sh-nav');
  if (!toggle || !nav) return;
  const label = toggle.querySelector('.sh-label');

  const setOpen = (open) => {
    header.classList.toggle('sh-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Cerrar' : 'Menú';
  };

  toggle.hidden = false;
  header.classList.add('sh-ready');
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('click', (event) => { if (!header.contains(event.target)) setOpen(false); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
})();
