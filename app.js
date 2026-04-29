// Navbar scroll shadow
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

// Mobile menu
const hamburger = document.getElementById('hamburger');
const navMobile = document.getElementById('nav-mobile');
hamburger.addEventListener('click', () => navMobile.classList.toggle('open'));
document.querySelectorAll('.nav-mobile a').forEach(link => {
  link.addEventListener('click', () => navMobile.classList.remove('open'));
});

// Active nav highlighting
const sections = document.querySelectorAll('section[id], header[id]');
const navAnchors = document.querySelectorAll('.nav-links a');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navAnchors.forEach(a => {
        a.style.color = a.getAttribute('href') === '#' + entry.target.id ? 'var(--navy)' : '';
      });
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });
sections.forEach(s => observer.observe(s));

// Fade-in on scroll
const fadeEls = document.querySelectorAll(
  '.skill-card, .timeline-content, .highlight-card, .edu-card, .metric, .project-card, .contact-info-card, .contact-form'
);
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });
fadeEls.forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(18px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  fadeObserver.observe(el);
});

// Formspree AJAX form submission
const form = document.getElementById('contactForm');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoading = document.getElementById('btnLoading');
    const successMsg = document.getElementById('formSuccess');
    const errorMsg = document.getElementById('formError');

    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    successMsg.style.display = 'none';
    errorMsg.style.display = 'none';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        successMsg.style.display = 'block';
        form.reset();
      } else {
        errorMsg.style.display = 'block';
      }
    } catch {
      errorMsg.style.display = 'block';
    }

    btn.disabled = false;
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
  });
}
