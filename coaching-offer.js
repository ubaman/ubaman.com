(() => {
  const offer = document.getElementById('coaching-offer');
  if (!offer) return;
  const key = 'ubaman-coaching-offer-dismissed-v1';
  try { if (sessionStorage.getItem(key) === '1') { offer.hidden = true; return; } } catch {}
  const close = offer.querySelector('.offer-close');
  close.hidden = false;
  close.addEventListener('click', () => {
    offer.hidden = true;
    try { sessionStorage.setItem(key, '1'); } catch {}
    const reserve = document.querySelector('.coach-copy .button-primary');
    if (reserve) reserve.focus({ preventScroll: true });
  });
})();
