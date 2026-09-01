// Agrega, elimina u ordena enlaces editando solamente esta lista.
const UBAMAN_LINKS = [
  {
    title: 'Twitch — Directos',
    description: 'Entra al stream y forma parte de la comunidad',
    url: 'https://www.twitch.tv/elubaman',
    icon: 'assets/twitch.svg',
    brand: 'twitch'
  },
  {
    title: 'YouTube',
    description: 'Videos, guías y contenido de League of Legends',
    url: 'https://www.youtube.com/@Ubaman?sub_confirmation=1',
    icon: 'assets/youtube.svg',
    brand: 'youtube'
  },
  {
    title: 'Instagram',
    description: 'Clips, noticias y contenido detrás de cámaras',
    url: 'https://www.instagram.com/elubaman/',
    icon: 'assets/instagram.svg',
    brand: 'instagram'
  },
  {
    title: 'Facebook',
    description: 'Videos y novedades de Ubaman',
    url: 'https://www.facebook.com/elubaman',
    icon: 'assets/facebook.svg',
    brand: 'facebook'
  },
  {
    title: 'Obtén tu RP en Bonoxs',
    description: 'Recargas y tarjetas para tus juegos',
    url: 'https://bonoxs.com/?utm_campaign=influ-Ubaman-league_of_legends--Jul2026&utm_medium=influ-instagram&utm_source=influencers',
    icon: 'RP'
  },
  {
    title: 'Maono en Mercado Libre',
    description: 'Micrófonos y equipo recomendado',
    url: 'https://bit.ly/41SgIXl',
    icon: '🎙'
  },
  {
    title: 'Promo Maono PD200W',
    description: 'Conoce el micrófono inalámbrico que uso',
    url: 'https://amzn.to/3PYDRoh',
    icon: 'M'
  },
  {
    title: 'Doomsday: Last Survivors x Ubaman',
    description: 'Página oficial de la colaboración',
    url: 'https://dls.igg.com/event/giveaway/?key=es/Ubaman',
    icon: 'DL'
  }
];

const linksContainer = document.querySelector('#dynamic-links');

UBAMAN_LINKS.forEach(link => {
  const anchor = document.createElement('a');
  anchor.className = `link-card${link.brand ? ` brand-${link.brand}` : ''}`;
  anchor.href = link.url;
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  const iconContent = link.icon.endsWith('.svg')
    ? `<img src="${link.icon}" alt="">`
    : link.icon;
  anchor.innerHTML = `
    <span class="link-icon">${iconContent}</span>
    <span class="link-copy"><strong>${link.title}</strong><small>${link.description}</small></span>
    <span class="link-arrow">↗</span>
  `;
  linksContainer.appendChild(anchor);
});

const copyButton = document.querySelector('#copy-page-link');
const copyStatus = document.querySelector('#copy-status');

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copyStatus.textContent = 'Enlace copiado';
  } catch {
    copyStatus.textContent = 'Copia la dirección desde la barra del navegador';
  }
  window.setTimeout(() => { copyStatus.textContent = ''; }, 2500);
});
