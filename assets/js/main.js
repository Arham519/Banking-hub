/**
 * Banking Hub - Global Main Script
 * Handles navigation, mobile drawer, toasts, favorites counter, FAQ accordions, and global search.
 */

const PBH_UI = (() => {
  // Toast notifications
  function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'warning' ? 'toast-warning' : ''}`;
    
    let iconClass = 'fa-solid fa-circle-check';
    if (type === 'warning') iconClass = 'fa-solid fa-triangle-exclamation';
    if (type === 'error') iconClass = 'fa-solid fa-circle-xmark';

    toast.innerHTML = `<i class="${iconClass}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Update navigation counters (Saved Banks & Comparison)
  function updateNavBadges() {
    const savedIds = PBH.getSavedBankIds();
    const compareIds = PBH.getCompareBankIds();

    const savedBadges = document.querySelectorAll('.saved-count-badge');
    savedBadges.forEach(b => {
      b.textContent = savedIds.length;
      b.style.display = savedIds.length > 0 ? 'flex' : 'none';
    });

    const compareBadges = document.querySelectorAll('.compare-count-badge');
    compareBadges.forEach(b => {
      b.textContent = compareIds.length;
      b.style.display = compareIds.length > 0 ? 'flex' : 'none';
    });
  }

  // Initialize mobile menu drawer
  function initMobileMenu() {
    const toggles = document.querySelectorAll('.mobile-menu-toggle');
    const drawer = document.querySelector('.mobile-drawer');
    const backdrop = document.querySelector('.mobile-drawer-backdrop');
    const closeBtn = document.querySelector('.mobile-drawer-close');

    if (!drawer || !backdrop) return;

    toggles.forEach(btn => {
      btn.addEventListener('click', () => {
        drawer.classList.add('open');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    });

    const closeDrawer = () => {
      drawer.classList.remove('open');
      backdrop.classList.remove('active');
      document.body.style.overflow = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
  }

  // FAQ Accordion
  function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const question = item.querySelector('.faq-question');
      if (!question) return;
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('active');
        faqItems.forEach(i => {
          i.classList.remove('active');
          const ans = i.querySelector('.faq-answer');
          if (ans) ans.style.maxHeight = null;
        });

        if (!isOpen) {
          item.classList.add('active');
          const ans = item.querySelector('.faq-answer');
          if (ans) ans.style.maxHeight = ans.scrollHeight + 'px';
        }
      });
    });
  }

  // Setup Global Search Form (e.g. in hero)
  function initGlobalSearch() {
    const forms = document.querySelectorAll('.global-search-form');
    forms.forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input[type="text"]');
        if (!input) return;
        const val = input.value.trim();
        const base = PBH.getBasePath();
        window.location.href = `${base}banks.html?search=${encodeURIComponent(val)}`;
      });
    });
  }

  // Setup saved bank listener
  window.addEventListener('pbh:saved-banks-updated', (e) => {
    updateNavBadges();
    const isSaved = e.detail.isSaved;
    showToast(isSaved ? 'Bank added to your saved list.' : 'Bank removed from saved list.', isSaved ? 'info' : 'warning');
  });

  window.addEventListener('pbh:compare-banks-updated', () => {
    updateNavBadges();
  });

  // Highlight current active navigation link
  function highlightActiveNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
    navLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      const linkFile = href.split('/').pop();
      if (linkFile === currentPath || (currentPath === '' && linkFile === 'index.html')) {
        link.classList.add('active');
      }
    });
  }

  return {
    init() {
      initMobileMenu();
      initFAQ();
      initGlobalSearch();
      updateNavBadges();
      highlightActiveNav();
    },
    showToast,
    updateNavBadges
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  PBH_UI.init();
});
