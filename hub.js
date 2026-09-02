const year = document.querySelector('#year');
const shareButton = document.querySelector('#share-button');
const shareStatus = document.querySelector('#share-status');

year.textContent = new Date().getFullYear();

const pageBackground = document.querySelector('.page-background');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(pointer: fine)');

if (pageBackground && !prefersReducedMotion.matches && finePointer.matches) {
  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;
  let animationFrame = 0;

  const easeBackground = () => {
    currentX += (targetX - currentX) * 0.075;
    currentY += (targetY - currentY) * 0.075;

    pageBackground.style.setProperty('--pointer-x', `${currentX.toFixed(2)}px`);
    pageBackground.style.setProperty('--pointer-y', `${currentY.toFixed(2)}px`);

    if (Math.abs(targetX - currentX) > 0.02 || Math.abs(targetY - currentY) > 0.02) {
      animationFrame = window.requestAnimationFrame(easeBackground);
    } else {
      animationFrame = 0;
    }
  };

  const moveBackground = (event) => {
    targetX = ((event.clientX / window.innerWidth) - 0.5) * -18;
    targetY = ((event.clientY / window.innerHeight) - 0.5) * -12;

    if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(easeBackground);
    }
  };

  const centerBackground = () => {
    targetX = 0;
    targetY = 0;

    if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(easeBackground);
    }
  };

  window.addEventListener('pointermove', moveBackground, { passive: true });
  document.documentElement.addEventListener('mouseleave', centerBackground);
  window.addEventListener('blur', centerBackground);
}

shareButton.addEventListener('click', async () => {
  const shareData = {
    title: 'Ubaman — Enlaces oficiales',
    text: 'Todos los enlaces oficiales de Ubaman',
    url: window.location.origin
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
      shareStatus.textContent = 'Copia ubaman.com desde tu navegador';
    }
  }

  window.setTimeout(() => {
    shareStatus.textContent = '';
  }, 2500);
});
