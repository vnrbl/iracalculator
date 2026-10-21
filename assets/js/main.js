/**
 * IRACALCULATOR (iracalculator.com) — MAIN INTERACTION & ACCESSIBILITY SCRIPTS
 * Mobile Navigation, Interactive Tooltips, FAQ Accordions, Share & Accessibility
 */

(function () {
  'use strict';

  function initApp() {
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
    // 7. Cookie / Consent Banner (placeholder — wires to no ad network)
    // -------------------------------------------------------------
    const CONSENT_KEY = 'ira_consent_choice';
    let storedChoice = null;
    try {
      storedChoice = localStorage.getItem(CONSENT_KEY);
    } catch (e) {
      storedChoice = null;
    }

    if (!storedChoice) {
      const banner = document.createElement('div');
      banner.className = 'consent-banner';
      banner.setAttribute('role', 'dialog');
      banner.setAttribute('aria-label', 'Cookie consent');
      banner.innerHTML = `
        <p>We use essential cookies to run this site and, with your consent, cookies that help fund it through advertising. Read our <a href="/privacy.html">Privacy Policy</a>.</p>
        <div class="consent-actions">
          <button type="button" class="btn btn-primary" data-consent="accept">Accept all</button>
          <button type="button" class="btn btn-outline" data-consent="essential">Essential only</button>
        </div>
      `;
      document.body.appendChild(banner);

      banner.querySelectorAll('[data-consent]').forEach(btn => {
        btn.addEventListener('click', () => {
          try {
            localStorage.setItem(CONSENT_KEY, btn.getAttribute('data-consent'));
          } catch (e) {
            /* storage unavailable — banner simply closes for this session */
          }
          banner.remove();
        });
      });
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
