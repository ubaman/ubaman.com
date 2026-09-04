const shareButton = document.querySelector('#share-button');
const shareStatus = document.querySelector('#share-status');
const background = document.querySelector('.ambient-background');

shareButton.addEventListener('click', async () => {
  const shareData = {
    title: 'Ubaman — Todos mis enlaces',
    text: 'Directos, videos y enlaces oficiales de Ubaman',
    url: 'https://ubaman.com/links/'
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      shareStatus.textContent = 'Página compartida';
    } else {
      await navigator.clipboard.writeText(shareData.url);
      shareStatus.textContent = 'Enlace copiado';
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      shareStatus.textContent = 'Copia ubaman.com/links/ desde tu navegador';
    }
  }

  window.setTimeout(() => {
    shareStatus.textContent = '';
  }, 2500);
});

if (
  background &&
  window.matchMedia('(pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches
) {
  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;
  let frame = 0;

  const render = () => {
    currentX += (targetX - currentX) * 0.07;
    currentY += (targetY - currentY) * 0.07;
    background.style.setProperty('--pointer-x', `${currentX.toFixed(2)}px`);
    background.style.setProperty('--pointer-y', `${currentY.toFixed(2)}px`);

    if (Math.abs(targetX - currentX) > 0.02 || Math.abs(targetY - currentY) > 0.02) {
      frame = window.requestAnimationFrame(render);
    } else {
      frame = 0;
    }
  };

  window.addEventListener('pointermove', event => {
    targetX = ((event.clientX / window.innerWidth) - 0.5) * -14;
    targetY = ((event.clientY / window.innerHeight) - 0.5) * -10;
    if (!frame) frame = window.requestAnimationFrame(render);
  }, { passive: true });
}
