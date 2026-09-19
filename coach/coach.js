const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

// Content stays visible if JavaScript or animation support is unavailable.
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && typeof Element.prototype.animate === 'function') {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (!motionPreference.matches) entry.target.animate(
        [{opacity: 0, transform: 'translateY(18px)'}, {opacity: 1, transform: 'translateY(0)'}],
        {duration: 550, easing: 'cubic-bezier(.2,.7,.2,1)'}
      );
    }
  }, {threshold: 0.12});
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) document.getAnimations().forEach(animation => animation.finish());
  });
}
