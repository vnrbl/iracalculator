/**
 * IRACALCULATOR (iracalculator.online) — MAIN INTERACTION & ACCESSIBILITY SCRIPTS
 * Mobile Navigation, Interactive Tooltips, FAQ Accordions, Share & Accessibility
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------
  // 0. Theme Controller — light / dark / follow the system
  //    The inline boot script in <head> sets the initial attributes before
  //    first paint; this module owns the UI and keeps system changes live.
  // ---------------------------------------------------------------
  function initTheme() {
    const STORAGE_KEY = 'ira_theme_mode';
    const MODES = ['light', 'dark', 'system'];
    const THEME_COLOR = { light: '#F8F6F0', dark: '#0F1512' };

    const root = document.documentElement;
    const toggle = document.getElementById('theme-toggle');
    const popover = document.getElementById('theme-popover');
    const options = popover ? Array.from(popover.querySelectorAll('[data-theme-value]')) : [];
    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const metaTheme = document.querySelector('meta[name="theme-color"]');

    function readMode() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (MODES.indexOf(saved) !== -1) return saved;
      } catch (e) {}
      return 'system';
    }

    function writeMode(mode) {
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch (e) {}
    }

    function resolveTheme(mode) {
      if (mode === 'light' || mode === 'dark') return mode;
      return media && media.matches ? 'dark' : 'light';
    }

    function paint(mode) {
      const theme = resolveTheme(mode);
      root.setAttribute('data-theme', theme);
      root.setAttribute('data-theme-mode', mode);

      if (metaTheme) metaTheme.setAttribute('content', THEME_COLOR[theme]);

      if (toggle) {
        const label = 'Color theme: ' + mode.charAt(0).toUpperCase() + mode.slice(1);
        toggle.setAttribute('aria-label', label);
        toggle.setAttribute('title', label);
      }

      options.forEach(option => {
        option.setAttribute(
          'aria-checked',
          option.getAttribute('data-theme-value') === mode ? 'true' : 'false'
        );
      });
    }

    function setMode(mode, persist) {
      if (MODES.indexOf(mode) === -1) mode = 'system';
      if (persist) writeMode(mode);
      paint(mode);
    }

    function openMenu() {
      if (!popover || !toggle) return;
      popover.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      const checked = popover.querySelector('[aria-checked="true"]') || options[0];
      if (checked) checked.focus();
    }

    function closeMenu(returnFocus) {
      if (!popover || !toggle) return;
      popover.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      if (returnFocus) toggle.focus();
    }

    // Sync the UI with whatever the boot script already resolved.
    setMode(readMode(), false);

    if (toggle && popover) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (popover.hidden) {
          openMenu();
        } else {
          closeMenu(false);
        }
      });

      options.forEach(option => {
        option.addEventListener('click', () => {
          setMode(option.getAttribute('data-theme-value'), true);
          closeMenu(true);
        });
      });

      // Roving arrow-key navigation inside the menu
      popover.addEventListener('keydown', (e) => {
        const current = options.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (!options.length) return;
          const step = e.key === 'ArrowDown' ? 1 : -1;
          const next = (current + step + options.length) % options.length;
          options[next].focus();
        }
      });

      document.addEventListener('click', (e) => {
        if (!popover.hidden && !popover.contains(e.target) && !toggle.contains(e.target)) {
          closeMenu(false);
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !popover.hidden) {
          closeMenu(true);
        }
      });
    }

    // Follow the OS live while the visitor is on "System".
    if (media) {
      const onSystemChange = () => {
        if (readMode() === 'system') paint('system');
      };
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onSystemChange);
      } else if (typeof media.addListener === 'function') {
        media.addListener(onSystemChange);
      }
    }

    // Keep multiple open tabs in sync.
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) paint(readMode());
    });
  }

  function initApp() {
    initTheme();

    // -------------------------------------------------------------
    // 1. Mobile Navigation & Drawer Management
    // -------------------------------------------------------------
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const siteNav = document.querySelector('.site-nav');
    const overlay = document.querySelector('.mobile-overlay');
    const closeBtn = document.querySelector('.mobile-nav-close');

    function openMobileMenu() {
      if (!siteNav) return;
      siteNav.classList.add('nav-open');
      if (overlay) overlay.classList.add('active');
      if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
    }

    function closeMobileMenu() {
      if (!siteNav) return;
      siteNav.classList.remove('nav-open');
      if (overlay) overlay.classList.remove('active');
      if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    }

    if (mobileBtn && siteNav) {
      mobileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (siteNav.classList.contains('nav-open')) {
          closeMobileMenu();
        } else {
          openMobileMenu();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMobileMenu();
      });
    }

    if (overlay) {
      overlay.addEventListener('click', closeMobileMenu);
    }

    // Close mobile menu on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMobileMenu();
        hideAllTooltips();
      }
    });

    // Close mobile drawer when clicking any link inside it
    if (siteNav) {
      siteNav.querySelectorAll('.nav-link, .nav-cta').forEach(link => {
        link.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            closeMobileMenu();
          }
        });
      });
    }

    // -------------------------------------------------------------
    // 2. Interactive Tooltips (Touch-Friendly Popovers)
    // -------------------------------------------------------------
    let activeTooltipPopover = null;

    function hideAllTooltips() {
      if (activeTooltipPopover) {
        activeTooltipPopover.remove();
        activeTooltipPopover = null;
      }
      document.querySelectorAll('.tooltip-btn.active').forEach(b => b.classList.remove('active'));
    }

    document.querySelectorAll('.tooltip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const text = btn.getAttribute('data-tooltip') || btn.getAttribute('title') || '';
        if (!text) return;

        const isAlreadyOpen = btn.classList.contains('active');
        hideAllTooltips();

        if (isAlreadyOpen) return;

        btn.classList.add('active');

        // Create popover element
        const popover = document.createElement('div');
        popover.className = 'tooltip-popover';
        popover.setAttribute('role', 'tooltip');
        popover.innerHTML = `
          <div class="tooltip-popover-content">
            <p>${text}</p>
            <button type="button" class="tooltip-close" aria-label="Close tooltip">&times;</button>
          </div>
        `;

        document.body.appendChild(popover);
        activeTooltipPopover = popover;

        // Position popover relative to button
        const rect = btn.getBoundingClientRect();
        const popoverWidth = Math.min(280, window.innerWidth - 32);
        popover.style.width = popoverWidth + 'px';

        let left = rect.left + rect.width / 2 - popoverWidth / 2;
        // Keep within viewport horizontally
        if (left < 16) left = 16;
        if (left + popoverWidth > window.innerWidth - 16) {
          left = window.innerWidth - 16 - popoverWidth;
        }

        // Place below if space permits, else above
        let top = rect.bottom + window.scrollY + 8;
        if (rect.bottom + 140 > window.innerHeight && rect.top > 140) {
          top = rect.top + window.scrollY - 8;
          popover.classList.add('popover-above');
        }

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;

        // Close on internal close button
        const closeX = popover.querySelector('.tooltip-close');
        if (closeX) {
          closeX.addEventListener('click', (ev) => {
            ev.stopPropagation();
            hideAllTooltips();
          });
        }
      });
    });

    // Dismiss tooltip on outside click
    document.addEventListener('click', (e) => {
      if (activeTooltipPopover && !activeTooltipPopover.contains(e.target)) {
        hideAllTooltips();
      }
    });

    // -------------------------------------------------------------
    // 3. FAQ Accordion with Smooth Animation
    // -------------------------------------------------------------
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const isActive = item.classList.contains('active');

        // Close other FAQs
        document.querySelectorAll('.faq-item').forEach(other => {
          if (other !== item) {
            other.classList.remove('active');
            const otherBtn = other.querySelector('.faq-question');
            if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          }
        });

        if (!isActive) {
          item.classList.add('active');
          btn.setAttribute('aria-expanded', 'true');
        } else {
          item.classList.remove('active');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // -------------------------------------------------------------
    // 4. Share / Copy Link
    // -------------------------------------------------------------
    const shareBtn = document.getElementById('btn-share-link');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(window.location.href).then(() => {
            const originalHTML = shareBtn.innerHTML;
            shareBtn.innerHTML = `
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              <span>Copied!</span>
            `;
            shareBtn.classList.add('btn-success');
            setTimeout(() => {
              shareBtn.innerHTML = originalHTML;
              shareBtn.classList.remove('btn-success');
            }, 2500);
          }).catch(() => {
            // Fallback
            prompt('Copy calculation URL:', window.location.href);
          });
        } else {
          prompt('Copy calculation URL:', window.location.href);
        }
      });
    }

    // -------------------------------------------------------------
    // 5. Scroll Animations (IntersectionObserver)
    // -------------------------------------------------------------
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      }, { threshold: 0.1 });

      document.querySelectorAll('.fade-in-section, .guide-card, .scenario-card').forEach(el => {
        observer.observe(el);
      });
    }

    // -------------------------------------------------------------
    // 6. Inline Form Validation (UI only — does not touch calculator math)
    // -------------------------------------------------------------
    const VALIDATION_RULES = [
      { id: 'input-balance', min: 1000, max: 2000000, msg: 'Enter a balance of at least $1,000.' },
      { id: 'input-growth', min: 0, max: 15, msg: 'Expected return must be between 0% and 15%.' },
      { id: 'input-income', min: 0, max: 5000000, msg: "Income can't be negative." },
      { id: 'input-age', min: 18, max: 95, msg: 'Enter an age between 18 and 95.' },
      { id: 'input-income-growth', min: 0, max: 10, msg: 'Income growth must be between 0% and 10%.' }
    ];

    VALIDATION_RULES.forEach(rule => {
      const input = document.getElementById(rule.id);
      if (!input) return;

      // Create the message element once, tied to the input for screen readers.
      const msgId = rule.id + '-error';
      const error = document.createElement('p');
      error.className = 'field-error';
      error.id = msgId;
      error.setAttribute('role', 'alert');
      const anchor = input.closest('.input-with-prefix') || input;
      anchor.insertAdjacentElement('afterend', error);

      const validate = () => {
        const raw = input.value.trim();
        const hasValue = raw !== '';
        const num = parseFloat(raw);
        const valid = hasValue && !Number.isNaN(num) && num >= rule.min && num <= rule.max;

        input.classList.toggle('invalid', !valid);
        if (valid) {
          input.removeAttribute('aria-invalid');
          input.removeAttribute('aria-describedby');
          error.textContent = '';
          error.classList.remove('show');
        } else {
          input.setAttribute('aria-invalid', 'true');
          input.setAttribute('aria-describedby', msgId);
          error.textContent = hasValue ? rule.msg : 'This field is required.';
          error.classList.add('show');
        }
        return valid;
      };

      input.addEventListener('blur', validate);
      input.addEventListener('input', () => {
        // Only clear errors while typing — do not nag on every keystroke.
        if (input.classList.contains('invalid')) validate();
      });
    });

    // -------------------------------------------------------------
    // 7. Cookie / Consent Banner
    // -------------------------------------------------------------
    const CONSENT_KEY = 'ira_consent_choice';
    const ONE_YEAR_SECS = 365 * 24 * 60 * 60;

    function getCookieDomain() {
      const hostname = window.location.hostname;
      if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || /^(\d+\.){3}\d+$/.test(hostname)) {
        return '';
      }
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        return '; domain=.' + parts.slice(-2).join('.');
      }
      return '';
    }

    function getStoredConsent() {
      // 1. Check localStorage
      try {
        const val = localStorage.getItem(CONSENT_KEY);
        if (val) return val;
      } catch (e) {}

      // 2. Check document.cookie
      try {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
          const c = cookies[i].trim();
          if (c.indexOf(CONSENT_KEY + '=') === 0) {
            return decodeURIComponent(c.substring(CONSENT_KEY.length + 1));
          }
        }
      } catch (e) {}

      // 3. Check sessionStorage
      try {
        const val = sessionStorage.getItem(CONSENT_KEY);
        if (val) return val;
      } catch (e) {}

      return null;
    }

    function saveConsent(choice) {
      const val = choice || 'essential';

      // 1. Save to localStorage
      try {
        localStorage.setItem(CONSENT_KEY, val);
      } catch (e) {}

      // 2. Save to document.cookie (1-year persistence across all subdomains)
      try {
        const domainStr = getCookieDomain();
        const secureStr = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${CONSENT_KEY}=${encodeURIComponent(val)}; path=/; max-age=${ONE_YEAR_SECS}; SameSite=Lax${domainStr}${secureStr}`;
      } catch (e) {}

      // 3. Save to sessionStorage
      try {
        sessionStorage.setItem(CONSENT_KEY, val);
      } catch (e) {}
    }

    const storedChoice = getStoredConsent();

    if (!storedChoice) {
      const banner = document.createElement('div');
      banner.className = 'consent-banner';
      banner.setAttribute('role', 'dialog');
      banner.setAttribute('aria-label', 'Cookie consent');
      banner.innerHTML = `
        <div class="consent-header">
          <p>We use essential cookies to run this site and, with your consent, cookies that help fund it through advertising. Read our <a href="/privacy.html" class="consent-policy-link">Privacy Policy</a>.</p>
          <button type="button" class="consent-close" aria-label="Dismiss cookie notice" data-consent="essential">&times;</button>
        </div>
        <div class="consent-actions">
          <button type="button" class="btn btn-primary" data-consent="accept">Accept all</button>
          <button type="button" class="btn btn-outline" data-consent="essential">Essential only</button>
        </div>
      `;
      document.body.appendChild(banner);

      const dismiss = (choice) => {
        saveConsent(choice);
        banner.remove();
      };

      banner.querySelectorAll('[data-consent]').forEach(btn => {
        btn.addEventListener('click', () => {
          dismiss(btn.getAttribute('data-consent'));
        });
      });

      // If user clicks Privacy Policy, remember essential so banner doesn't block the policy page
      const policyLink = banner.querySelector('.consent-policy-link');
      if (policyLink) {
        policyLink.addEventListener('click', () => {
          saveConsent('essential');
        });
      }
    }

    // -------------------------------------------------------------
    // 8. Sticky header — add a frosted, elevated state once scrolled
    // -------------------------------------------------------------
    const siteHeader = document.querySelector('.site-header');
    if (siteHeader) {
      let ticking = false;
      const syncHeader = () => {
        siteHeader.classList.toggle('is-scrolled', window.scrollY > 8);
        ticking = false;
      };
      syncHeader();
      window.addEventListener('scroll', () => {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(syncHeader);
        }
      }, { passive: true });
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
