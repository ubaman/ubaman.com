// Alterna el reproductor de "Mis directos" entre Twitch y Kick.
(() => {
  const tabs = [...document.querySelectorAll('.live-switch [role="tab"]')];
  const panel = document.getElementById('live-player');
  const openLink = document.querySelector('.live-open');
  if (!tabs.length || !panel) return;

  const platforms = {
    twitch: {
      name: 'Twitch',
      page: 'https://www.twitch.tv/elubaman',
      embed: () => `https://player.twitch.tv/?channel=elubaman&parent=${window.location.hostname}&autoplay=true`,
      launch: 'https://player.twitch.tv/?channel=elubaman&parent=ubaman.com&autoplay=false'
    },
    kick: {
      name: 'Kick',
      page: 'https://kick.com/ubaman',
      embed: () => 'https://player.kick.com/ubaman?autoplay=true',
      launch: 'https://player.kick.com/ubaman?autoplay=true'
    }
  };

  const select = (tab) => {
    const p = platforms[tab.dataset.platform];
    tabs.forEach((t) => {
      const active = t === tab;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tab.id);
    openLink.href = p.page;
    openLink.firstChild.textContent = `Abrir en ${p.name} `;

    // Si el reproductor ya está cargado, se cambia directamente de canal.
    const frame = panel.querySelector('iframe');
    if (frame) {
      frame.src = p.embed();
      frame.title = `Directo de Ubaman en ${p.name}`;
      return;
    }
    const launch = panel.querySelector('.media-launch');
    if (launch) {
      launch.dataset.embedSrc = p.launch;
      launch.dataset.embedTitle = `Directo de Ubaman en ${p.name}`;
      launch.setAttribute('aria-label', `Cargar el reproductor de ${p.name}`);
      launch.querySelector('.launch-label').textContent = `VER EN ${p.name.toUpperCase()}`;
    }
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const next = tabs[(i + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      select(next);
    });
  });
})();
