const year = document.querySelector('#year');

if (year) {
  year.textContent = new Date().getFullYear();
}

const topbar = document.querySelector('.topbar');
const menuToggle = document.querySelector('#menu-toggle');
const primaryNavigation = document.querySelector('#primary-navigation');

if (topbar && menuToggle && primaryNavigation) {
  const mobileMenu = window.matchMedia('(max-width: 900px)');
  const menuLabel = menuToggle.querySelector('.menu-label');

  const setMenuOpen = (open) => {
    topbar.classList.toggle('menu-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    if (menuLabel) menuLabel.textContent = open ? 'Cerrar' : 'Menú';
  };

  setMenuOpen(false);
  menuToggle.hidden = false;
  topbar.classList.add('menu-ready');

  menuToggle.addEventListener('click', () => {
    if (mobileMenu.matches) {
      setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
    }
  });

  primaryNavigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenuOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (!topbar.contains(event.target)) setMenuOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      setMenuOpen(false);
      menuToggle.focus();
    }
  });

  mobileMenu.addEventListener('change', () => {
    if (!mobileMenu.matches) setMenuOpen(false);
  });
}

const shareButton = document.querySelector('#share-button');
const shareStatus = document.querySelector('#share-status');

if (shareButton && shareStatus) {
  let shareStatusTimeout;

  shareButton.addEventListener('click', async () => {
    const shareData = {
      title: 'Ubaman — Gaming, directos y comunidad',
      text: 'Nos vemos en el próximo directo de Ubaman.',
      url: window.location.origin
    };

    window.clearTimeout(shareStatusTimeout);

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        shareStatus.textContent = '¡Nos vemos en el directo!';
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
        shareStatus.textContent = 'Dirección copiada';
      } else {
        shareStatus.textContent = 'Comparte ubaman.com con tu squad';
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        shareStatus.textContent = 'Comparte ubaman.com con tu squad';
      }
    }

    shareStatusTimeout = window.setTimeout(() => {
      shareStatus.textContent = '';
    }, 4000);
  });
}

// Los reproductores externos solo se cargan cuando el visitante decide verlos.
document.querySelectorAll('.media-launch[data-embed-src][data-embed-title]').forEach((button) => {
  button.addEventListener('click', () => {
    const preview = button.closest('.media-preview');
    if (!preview) return;

    const embedUrl = new URL(button.dataset.embedSrc, window.location.href);
    if (embedUrl.hostname === 'player.twitch.tv') {
      embedUrl.searchParams.set('parent', window.location.hostname);
      embedUrl.searchParams.set('autoplay', 'true');
    }

    const iframe = document.createElement('iframe');
    iframe.src = embedUrl.href;
    iframe.title = button.dataset.embedTitle;
    iframe.className = 'media-frame';
    iframe.allowFullscreen = true;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.tabIndex = 0;
    preview.replaceChildren(iframe);
    iframe.focus();
  });
});
