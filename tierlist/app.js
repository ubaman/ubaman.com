(() => {
  const data = Array.isArray(window.UBAMAN_TIER_DATA) ? window.UBAMAN_TIER_DATA : [];
  const list = document.querySelector('#tier-list');
  const empty = document.querySelector('#empty-state');
  const search = document.querySelector('#champion-search');
  const buttons = [...document.querySelectorAll('[data-role]')];
  const order = ['S+','S','A','B','C','D'];
  const roleNames = {Baron:'Baron',Jungle:'Jungla',Mid:'Mid','Duo (ADC)':'ADC',Support:'Soporte'};
  let role = 'Todos';

  const safe = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  function render() {
    const term = normalize(search.value.trim());
    const filtered = data.filter(champion =>
      (role === 'Todos' || champion.role === role) &&
      (!term || normalize(champion.name).includes(term))
    );

    list.innerHTML = order.map(tier => {
      const champions = filtered.filter(champion => champion.tier === tier);
      if (!champions.length) return '';
      return `<section class="tier-row" data-tier="${tier}">
        <div class="tier-rank" aria-label="Tier ${tier}">${tier}</div>
        <div class="champions">
          ${champions.map(champion => `<article class="champion">
            <span class="champion-mark" aria-hidden="true">${safe(champion.name.charAt(0))}</span>
            <span><strong class="champion-name">${safe(champion.name)}</strong><small class="champion-role">${safe(roleNames[champion.role] || champion.role)}</small></span>
            <span class="stats">
              <span>WR<strong>${champion.win.toFixed(2)}%</strong></span>
              <span>PICK<strong>${champion.pick.toFixed(2)}%</strong></span>
              <span>BAN<strong>${champion.ban.toFixed(2)}%</strong></span>
            </span>
          </article>`).join('')}
        </div>
      </section>`;
    }).join('');

    empty.hidden = filtered.length > 0;
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    role = button.dataset.role;
    buttons.forEach(item => item.classList.toggle('active', item === button));
    render();
  }));
  search.addEventListener('input', render);
  render();
})();