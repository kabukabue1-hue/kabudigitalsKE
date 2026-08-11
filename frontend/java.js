/* =========================================================
   KABU DIGITALS — script.js
   Vanilla JS only. No dependencies, no backend required.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------------------------------------------------
     CONFIG — edit these values to rebrand / reconnect contacts
  --------------------------------------------------------- */
  const CONFIG = {
    // Replace with the real WhatsApp number in international
    // format, digits only (no + or spaces), e.g. 254712345678
    whatsappNumber: '254708892450',
    whatsappDefaultMessage: "Hi KABU DIGITALS, I'd like to discuss a project.",
    // Replace with the email address that should receive project requests
    contactEmail: 'perezkungu@gmail.com',
    // The Render backend serves this frontend too, so same-origin is the
    // correct production default. Override it for a separately hosted site.
    apiBaseUrl: window.KABU_API_BASE_URL ||
      (window.location.protocol === 'http:' || window.location.protocol === 'https:'
        ? window.location.origin
        : 'http://localhost:4000'),
  };

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------
     WHATSAPP LINKS
  --------------------------------------------------------- */
  function buildWhatsappUrl(message) {
    const text = encodeURIComponent(message || CONFIG.whatsappDefaultMessage);
    return `https://wa.me/${CONFIG.whatsappNumber}?text=${text}`;
  }

  document.querySelectorAll('#whatsappFloat, #footerWhatsapp, #finalCtaWhatsapp')
    .forEach((el) => { el.href = buildWhatsappUrl(); });

  /* ---------------------------------------------------------
     STICKY NAV — becomes solid/blurred on scroll
  --------------------------------------------------------- */
  const nav = document.getElementById('siteNav');
  const updateNavState = () => {
    if (window.scrollY > 24) {
      nav.classList.add('is-scrolled');
    } else {
      nav.classList.remove('is-scrolled');
    }
  };
  updateNavState();
  window.addEventListener('scroll', updateNavState, { passive: true });

  /* ---------------------------------------------------------
     MOBILE MENU TOGGLE
  --------------------------------------------------------- */
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');

  function closeMobileMenu() {
    mobileMenu.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
  }

  navToggle.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  });

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMobileMenu);
  });

  /* ---------------------------------------------------------
     SCROLL REVEAL ANIMATIONS
  --------------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach((el) => revealObserver.observe(el));
  }

  /* ---------------------------------------------------------
     FAQ ACCORDION
  --------------------------------------------------------- */
  const accordionTriggers = document.querySelectorAll('.accordion__trigger');

  accordionTriggers.forEach((trigger) => {
    const panel = trigger.closest('.accordion__item').querySelector('.accordion__panel');

    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      // Close all other panels for a clean single-open accordion
      accordionTriggers.forEach((otherTrigger) => {
        if (otherTrigger !== trigger) {
          otherTrigger.setAttribute('aria-expanded', 'false');
          otherTrigger.closest('.accordion__item').querySelector('.accordion__panel').style.maxHeight = null;
        }
      });

      trigger.setAttribute('aria-expanded', String(!isOpen));
      panel.style.maxHeight = isOpen ? null : 'none';
    });
  });

  /* ---------------------------------------------------------
     STAT COUNTER ANIMATION
  --------------------------------------------------------- */
  const statNums = document.querySelectorAll('.stat__num[data-target]');

  function animateCount(el) {
    const target = parseInt(el.getAttribute('data-target'), 10);
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1200;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (statNums.length) {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      statNums.forEach((el) => {
        el.textContent = el.getAttribute('data-target') + (el.getAttribute('data-suffix') || '');
      });
    } else {
      const statObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });

      statNums.forEach((el) => statObserver.observe(el));
    }
  }

  /* ---------------------------------------------------------
     CONTACT FORM — send project requests to the backend.
  --------------------------------------------------------- */
  const contactForm = document.getElementById('contactForm');
  const formNote = document.getElementById('formNote');

  function openMailtoFallback(data) {
    const subject = `Project Request - ${data.service || 'General Enquiry'}`;
    const body = [
      `Name: ${data.name || ''}`,
      `Business/Company: ${data.company || ''}`,
      `Email: ${data.email || ''}`,
      `Phone/WhatsApp: ${data.phone || ''}`,
      `Service Needed: ${data.service || ''}`,
      `Budget: ${data.budget || ''}`,
      '',
      'Project Details:',
      data.details || '',
    ].join('\n');
    window.location.href = `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  if (contactForm) {
    contactForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const data = Object.fromEntries(new FormData(contactForm).entries());
      const submitButton = contactForm.querySelector('button[type="submit"]');

      if (!CONFIG.apiBaseUrl) {
        openMailtoFallback(data);
        formNote.textContent = 'Opening your email app with these details filled in.';
        return;
      }

      submitButton.disabled = true;
      formNote.textContent = 'Sending your project request...';

      try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/api/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Request failed.');
        contactForm.reset();
        formNote.textContent = "Thanks - your project request has been received. We'll be in touch shortly.";
      } catch (error) {
        openMailtoFallback(data);
        formNote.textContent = "We couldn't reach our server, so we've opened your email app instead - please hit send there.";
      } finally {
        submitButton.disabled = false;
      }
    });
  }
});