/* ═══════════════════════════════════════════════════════════════════════
   UI ENHANCEMENTS v2.0 — Kill Switch Simulation
   Micro-interaction & ambient JS layer.
   Self-initialising IIFE — imported as side-effect in main.jsx.
   Does NOT touch React state, context, or component props.
   ═══════════════════════════════════════════════════════════════════════ */
(function uiEnhancements() {
  'use strict';

  /* ──────────────────────────────────────────────
     Guard — run once, only in browser
     ────────────────────────────────────────────── */
  if (typeof window === 'undefined') return;
  if (window.__uiEnhancementsLoaded) return;
  window.__uiEnhancementsLoaded = true;

  /* ═══════════════════════════════════════════════
     § 1  AMBIENT GLOW ORBS
     ═══════════════════════════════════════════════ */
  function injectAmbientGlow() {
    if (document.querySelector('.ambient-glow')) return;
    const wrap = document.createElement('div');
    wrap.className = 'ambient-glow';
    wrap.innerHTML = `
      <div class="ambient-glow__orb ambient-glow__orb--cyan"></div>
      <div class="ambient-glow__orb ambient-glow__orb--emerald"></div>
      <div class="ambient-glow__orb ambient-glow__orb--rose"></div>
    `;
    document.body.appendChild(wrap);
    // Fade in after a tick
    requestAnimationFrame(() => {
      requestAnimationFrame(() => wrap.classList.add('active'));
    });
  }

  /* ═══════════════════════════════════════════════
     § 2  KEYBOARD SHORTCUT TOOLTIP — DISABLED
     ═══════════════════════════════════════════════ */
  function initKeyboardTooltips() {
    // Intentionally empty — tooltips removed per user request.
    // Controls are shown in the HUD Command Panel instead.
  }

  /* ═══════════════════════════════════════════════
     § 3  VIEW TOGGLE — SCREEN FLASH
     ═══════════════════════════════════════════════ */
  function initViewToggleFlash() {
    let flashEl = null;

    function getFlash() {
      if (!flashEl) {
        flashEl = document.createElement('div');
        flashEl.className = 'view-transition-flash';
        document.body.appendChild(flashEl);
      }
      return flashEl;
    }

    // Watch for clicks on the view toggle pill
    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('div[role="switch"]');
      if (!toggle) return;
      const cl = toggle.className || '';
      if (!cl.includes('fixed') || !cl.includes('top-4') || !cl.includes('right-4')) return;

      const flash = getFlash();
      flash.classList.remove('active');
      // Force reflow
      void flash.offsetWidth;
      flash.classList.add('active');
      setTimeout(() => flash.classList.remove('active'), 500);
    });
  }

  /* ═══════════════════════════════════════════════
     § 4  PANEL PARALLAX DEPTH (2D side panels)
     ═══════════════════════════════════════════════ */
  function initPanelParallax() {
    let ticking = false;

    function onMove(e) {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const cx = (e.clientX / window.innerWidth - 0.5) * 2;   // -1 … 1
        const cy = (e.clientY / window.innerHeight - 0.5) * 2;

        const panels = document.querySelectorAll('aside > div');
        panels.forEach((p, i) => {
          const depth = 1 + i * 0.4;
          const tx = cx * depth * 0.6;
          const ty = cy * depth * 0.4;
          p.style.transform = `translate(${tx}px, ${ty}px)`;
        });
        ticking = false;
      });
    }

    document.addEventListener('mousemove', onMove, { passive: true });
  }

  /* ═══════════════════════════════════════════════
     § 5  CURSOR RING (2D view overlay)
     ═══════════════════════════════════════════════ */
  function initCursorRing() {
    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    document.body.appendChild(ring);

    let mx = -100, my = -100;
    let rx = -100, ry = -100;
    let visible = false;

    document.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      if (!visible) {
        visible = true;
        ring.style.opacity = '1';
      }
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      visible = false;
      ring.style.opacity = '0';
    });

    // Hover detection — expand on interactive elements
    document.addEventListener('mouseover', (e) => {
      const t = e.target;
      if (!t) return;
      const isInteractive = t.closest('button, a, [role="button"], input, .cursor-pointer, svg rect[cursor]');
      ring.classList.toggle('hovering', !!isInteractive);
    }, { passive: true });

    // Smooth follow loop
    function follow() {
      rx += (mx - rx) * 0.15;
      ry += (my - ry) * 0.15;
      ring.style.left = rx + 'px';
      ring.style.top = ry + 'px';
      requestAnimationFrame(follow);
    }
    follow();

    // Hide in 3D view (Canvas captures pointer)
    const observer = new MutationObserver(() => {
      const canvas = document.querySelector('canvas');
      ring.style.display = canvas && canvas.offsetParent !== null ? 'none' : '';
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ═══════════════════════════════════════════════
     § 6  SIDE NAV BUTTON RIPPLE
     ═══════════════════════════════════════════════ */
  function initNavRipple() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const cl = btn.className || '';
      // Side nav buttons: w-10 h-10 rounded-xl
      if (!cl.includes('w-10') || !cl.includes('h-10') || !cl.includes('rounded-xl')) return;

      const ripple = document.createElement('span');
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      Object.assign(ripple.style, {
        position: 'absolute',
        width: size + 'px',
        height: size + 'px',
        left: x + 'px',
        top: y + 'px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.2)',
        transform: 'scale(0)',
        opacity: '1',
        pointerEvents: 'none',
        zIndex: '10',
      });

      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);

      requestAnimationFrame(() => {
        ripple.style.transition = 'transform .45s ease-out, opacity .45s ease-out';
        ripple.style.transform = 'scale(1)';
        ripple.style.opacity = '0';
      });

      setTimeout(() => ripple.remove(), 500);
    });
  }

  /* ═══════════════════════════════════════════════
     § 7  PANEL ENTRY STAGGER (IntersectionObserver)
     ═══════════════════════════════════════════════ */
  function initPanelStagger() {
    const style = document.createElement('style');
    style.textContent = `
      .panel-reveal {
        opacity: 0;
        transform: translateY(10px);
        transition: opacity .45s cubic-bezier(.16,1,.3,1), transform .45s cubic-bezier(.16,1,.3,1);
      }
      .panel-reveal.visible {
        opacity: 1;
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    // Re-scan periodically for dynamically added panels
    function scan() {
      document.querySelectorAll('aside > div:not(.panel-reveal)').forEach((el, i) => {
        el.classList.add('panel-reveal');
        el.style.transitionDelay = (i * 80) + 'ms';
        io.observe(el);
      });
    }

    // Initial + periodic scan
    scan();
    setInterval(scan, 3000);
  }

  /* ═══════════════════════════════════════════════
     § 8  INTERACT BUTTON PULSE (near station)
     ═══════════════════════════════════════════════ */
  function initInteractPulse() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes interact-pulse {
        0%, 100% { box-shadow: 0 0 8px rgba(6,182,212,.2); }
        50%      { box-shadow: 0 0 22px rgba(6,182,212,.45), 0 0 50px rgba(6,182,212,.1); }
      }
      button[class*="from-cyan-700"] {
        animation: interact-pulse 2.5s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }

  /* ═══════════════════════════════════════════════
     § 9  SOC CLOCK — Live IST timestamp
     ═══════════════════════════════════════════════ */
  function initSOCClock() {
    const style = document.createElement('style');
    style.textContent = `
      .soc-clock {
        position: fixed;
        bottom: 8px;
        right: 8px;
        z-index: 90;
        padding: 4px 12px;
        border-radius: 6px;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 10px;
        letter-spacing: .1em;
        color: rgba(148,163,184,.5);
        background: rgba(15,23,42,.6);
        border: 1px solid rgba(100,116,139,.1);
        pointer-events: none;
        font-variant-numeric: tabular-nums;
      }
      .soc-clock span {
        color: rgba(6,182,212,.5);
      }
    `;
    document.head.appendChild(style);

    const clock = document.createElement('div');
    clock.className = 'soc-clock';
    document.body.appendChild(clock);

    function tick() {
      const now = new Date();
      // IST = UTC + 5:30
      const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const h = String(ist.getUTCHours()).padStart(2, '0');
      const m = String(ist.getUTCMinutes()).padStart(2, '0');
      const s = String(ist.getUTCSeconds()).padStart(2, '0');
      clock.innerHTML = `<span>IST</span> ${h}:${m}:${s}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ═══════════════════════════════════════════════
     § 10  SOC SCAN SWEEP — Radar-style sweep on minimap
     ═══════════════════════════════════════════════ */
  function initScanSweep() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes soc-sweep {
        0%   { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .soc-sweep-overlay {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        z-index: 3;
        overflow: hidden;
      }
      .soc-sweep-overlay::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        transform-origin: 0 0;
        background: conic-gradient(
          from 0deg,
          transparent 0deg,
          rgba(6,182,212,.06) 30deg,
          transparent 60deg
        );
        animation: soc-sweep 8s linear infinite;
      }
    `;
    document.head.appendChild(style);

    // Watch for minimap and inject sweep overlay
    function inject() {
      const minimap = document.querySelector('.soc-minimap, .minimap');
      if (minimap && !minimap.querySelector('.soc-sweep-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'soc-sweep-overlay';
        minimap.appendChild(overlay);
      }
    }

    inject();
    // Re-check periodically (view toggles destroy/recreate DOM)
    setInterval(inject, 2000);
  }

  /* ═══════════════════════════════════════════════
     INIT — Run all modules when DOM is ready
     ═══════════════════════════════════════════════ */
  function init() {
    injectAmbientGlow();
    initKeyboardTooltips();
    initViewToggleFlash();
    initPanelParallax();
    initCursorRing();
    initNavRipple();
    initPanelStagger();
    initInteractPulse();
    initSOCClock();
    initScanSweep();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already ready (likely because Vite HMR or deferred import)
    init();
  }
})();
