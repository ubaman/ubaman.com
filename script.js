const menu = document.querySelector('.menu');
const links = document.querySelector('.nav-links');
menu.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  menu.setAttribute('aria-expanded', open);
});
links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  links.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
}));
document.querySelectorAll('[data-plan]').forEach(button => button.addEventListener('click', () => {
  const contact = document.querySelector('#contact-button');
  const plan = button.dataset.plan;
  contact.href = `https://wa.me/5210000000000?text=${encodeURIComponent(`Hola Ubaman, me interesa el plan ${plan}. Quiero más información.`)}`;
}));
document.querySelector('#year').textContent = new Date().getFullYear();
const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) entry.target.classList.add('visible');
}), { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
