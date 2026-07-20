(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── Counter animation ─────────────────────────────────── */
  function animateCounter(el) {
    const target = parseFloat(el.dataset.count);
    if (isNaN(target)) return;
    const prefix  = el.dataset.prefix  || '';
    const suffix  = el.dataset.suffix  || '';
    const decimals = (String(target).split('.')[1] || '').length;
    const duration = reduced ? 0 : 1000;
    const start = performance.now();

    el.textContent = prefix + '0' + suffix;

    if (duration === 0) {
      el.textContent = prefix + Number(target).toLocaleString('ar-EG', { maximumFractionDigits: decimals }) + suffix;
      return;
    }

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 4);
      el.textContent = prefix + Number(eased * target).toLocaleString('ar-EG', { maximumFractionDigits: decimals }) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ─── Scroll reveal ─────────────────────────────────────── */
  function initScrollReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    if (reduced) {
      els.forEach(el => el.classList.add('visible'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

    els.forEach(el => io.observe(el));
  }

  /* ─── Page transition ────────────────────────────────────── */
  function initPageTransition() {
    if (reduced) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;opacity:0;pointer-events:none;transition:opacity 0.2s ease;';
    document.body.appendChild(overlay);

    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('//') || href.startsWith('javascript')) return;
      link.addEventListener('click', () => {
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'all';
      });
    });

    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
      }
    });
  }

  /* ─── Button ripple ─────────────────────────────────────── */
  function initRipple() {
    if (reduced) return;

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn || btn.classList.contains('disabled')) return;

      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ripple = document.createElement('span');
      const size   = Math.max(rect.width, rect.height) * 2;
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x - size / 2}px;
        top: ${y - size / 2}px;
        background: rgba(255,255,255,0.12);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple-expand 0.5s ease-out forwards;
        pointer-events: none;
      `;
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });

    /* Inject ripple keyframe once */
    if (!document.getElementById('ripple-style')) {
      const s = document.createElement('style');
      s.id = 'ripple-style';
      s.textContent = '@keyframes ripple-expand{to{transform:scale(1);opacity:0}}';
      document.head.appendChild(s);
    }
  }

  /* ─── Input focus glow ─────────────────────────────────── */
  function initInputEffects() {
    document.querySelectorAll('.glass-input').forEach(input => {
      input.addEventListener('focus', () => {
        const label = input.closest('.form-group')?.querySelector('label');
        if (label) label.style.color = '#fff';
      });
      input.addEventListener('blur', () => {
        const label = input.closest('.form-group')?.querySelector('label');
        if (label) label.style.color = '';
      });
    });
  }

  /* ─── Sidebar tooltip on collapsed ─────────────────────── */
  function initSidebarTooltips() {
    const sidebar = document.querySelector('.app-sidebar');
    if (!sidebar) return;

    const updateTooltips = () => {
      const collapsed = sidebar.classList.contains('collapsed');
      sidebar.querySelectorAll('.nav-link').forEach(link => {
        const text = link.querySelector('.sidebar-text');
        if (text) link.title = collapsed ? text.textContent.trim() : '';
      });
    };

    updateTooltips();

    const toggle = document.getElementById('sidebarToggle');
    if (toggle) toggle.addEventListener('click', () => setTimeout(updateTooltips, 250));
  }

  /* ─── Stagger nav links on sidebar open ────────────────── */
  function initSidebarLinkAnimation() {
    if (reduced) return;

    const links = document.querySelectorAll('.nav-link');
    links.forEach((link, i) => {
      link.style.animationDelay = `${i * 0.03}s`;
      link.style.animation = `fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) both`;
    });
  }

  /* ─── Auto-hide alerts ──────────────────────────────────── */
  function initAutoHideAlerts() {
    document.querySelectorAll('.alert').forEach(alert => {
      setTimeout(() => {
        alert.style.transition = 'opacity 0.5s ease, transform 0.5s ease, max-height 0.4s ease, padding 0.4s ease, margin 0.4s ease';
        alert.style.opacity = '0';
        alert.style.transform = 'translateY(-8px)';
        alert.style.maxHeight = '0';
        alert.style.padding = '0';
        alert.style.margin = '0';
        setTimeout(() => alert.remove(), 500);
      }, 4000);
    });
  }

  /* ─── Active nav link highlight ────────────────────────── */
  function initActiveNav() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && href !== '/' && path.startsWith(href)) {
        link.classList.add('active');
      }
    });
  }

  /* ─── Card tilt on hover ───────────────────────────────── */
  function initCardTilt() {
    if (reduced) return;

    document.querySelectorAll('.guild-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width  - 0.5;
        const y = (e.clientY - rect.top)  / rect.height - 0.5;
        card.style.transform = `translateY(-2px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ─── Init ──────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    /* Counters */
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));

    initScrollReveal();
    initPageTransition();
    initRipple();
    initInputEffects();
    initSidebarTooltips();
    initSidebarLinkAnimation();
    initAutoHideAlerts();
    initActiveNav();
    initCardTilt();

    /* Fade in content */
    const content = document.querySelector('.app-content');
    if (content && !reduced) {
      content.style.opacity = '0';
      content.style.transform = 'translateY(8px)';
      content.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          content.style.opacity = '1';
          content.style.transform = 'translateY(0)';
        });
      });
    }
  });
})();
