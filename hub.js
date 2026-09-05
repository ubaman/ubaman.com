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


const coachPromo = document.querySelector('#coach-promo');
const coachTimer = document.querySelector('#coach-timer');
const promoClose = document.querySelector('#promo-close');

if (coachPromo && coachTimer && promoClose) {
  const duration = 20 * 60 * 1000;
  const deadlineKey = 'ubaman-coach-promo-deadline-v1';
  const dismissedKey = 'ubaman-coach-promo-dismissed-v1';
  let deadline = Date.now() + duration;

  try {
    const savedDeadline = window.localStorage.getItem(deadlineKey);
    if (savedDeadline === null) {
      window.localStorage.setItem(deadlineKey, String(deadline));
    } else {
      const parsedDeadline = Number(savedDeadline);
      deadline = Number.isFinite(parsedDeadline) ? parsedDeadline : deadline;
      if (!Number.isFinite(parsedDeadline)) {
        window.localStorage.setItem(deadlineKey, String(deadline));
      }
    }

    if (window.sessionStorage.getItem(dismissedKey) === 'true') {
      coachPromo.hidden = true;
    }
  } catch (error) {
    // El contador sigue funcionando aunque el navegador bloquee el almacenamiento.
  }

  const hidePromotion = () => {
    coachPromo.classList.add('is-expiring');
    window.setTimeout(() => {
      coachPromo.hidden = true;
    }, 700);
  };

  const updatePromotion = () => {
    const remaining = Math.max(0, deadline - Date.now());

    if (remaining <= 0) {
      coachTimer.textContent = '00:00';
      hidePromotion();
      return false;
    }

    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    coachTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    coachTimer.setAttribute('aria-label', `${minutes} minutos y ${seconds} segundos restantes`);
    return true;
  };

  if (deadline <= Date.now() || coachPromo.hidden) {
    coachPromo.hidden = true;
  } else {
    updatePromotion();
    const timerInterval = window.setInterval(() => {
      if (!updatePromotion()) {
        window.clearInterval(timerInterval);
      }
    }, 1000);
  }

  promoClose.addEventListener('click', () => {
    try {
      window.sessionStorage.setItem(dismissedKey, 'true');
    } catch (error) {
      // Cerrar la promoción no depende del almacenamiento.
    }
    hidePromotion();
  });
}
