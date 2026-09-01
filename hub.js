const year = document.querySelector('#year');
const shareButton = document.querySelector('#share-button');
const shareStatus = document.querySelector('#share-status');

year.textContent = new Date().getFullYear();

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
