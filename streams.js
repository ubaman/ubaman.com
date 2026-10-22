// Alterna el reproductor de "Mis directos" entre Twitch y Kick; el directo carga sin pulsar play.
(() => {
  const tabs = [...document.querySelectorAll('.live-switch [role="tab"]')];
  const panel = document.getElementById('live-player');
  const frame = panel && panel.querySelector('iframe');
  const openLink = document.querySelector('.live-open');
  if (!tabs.length || !frame) return;

  const platforms = {
    twitch: {
      name: 'Twitch',
      page: 'https://www.twitch.tv/elubaman',
      // Twitch solo permite el reproductor en el dominio indicado en "parent".
      embed: () => `https://player.twitch.tv/?channel=elubaman&parent=${window.location.hostname}&autoplay=true&muted=true`
    },
    kick: {
      name: 'Kick',
      page: 'https://kick.com/ubaman',
      embed: () => 'https://player.kick.com/ubaman?autoplay=true&muted=true'
    }
  };

  if (window.location.hostname !== 'ubaman.com') frame.src = platforms.twitch.embed();

  const select = (tab) => {
    const p = platforms[tab.dataset.platform];
    tabs.forEach((t) => {
      const active = t === tab;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tab.id);
    frame.src = p.embed();
    frame.title = `Directo de Ubaman en ${p.name}`;
    openLink.href = p.page;
    openLink.firstChild.textContent = `Abrir en ${p.name} `;
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
