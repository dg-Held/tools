// mobile nav toggle
const btn = document.getElementById('nav-toggle');
const nav = document.getElementById('main-nav');
btn?.addEventListener('click', () => {
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!expanded));
  document.body.classList.toggle('nav-open');
});

// insert current year
const y = new Date().getFullYear();
document.getElementById('year').textContent = y;
