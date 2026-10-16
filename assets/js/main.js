(function () {
  'use strict';

  // Flag that JS is available — CSS uses this to apply the mobile nav
  // toggle behavior and the reveal-on-scroll states. Without JS, all
  // content stays visible.
  document.documentElement.classList.add('js');

  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.site-nav');
  if (toggle && nav) {
    var setNavOpen = function (open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    toggle.addEventListener('click', function () {
      setNavOpen(!nav.classList.contains('is-open'));
    });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setNavOpen(false);
    });
    document.addEventListener('click', function (event) {
      if (nav.classList.contains('is-open') && !nav.contains(event.target) && !toggle.contains(event.target)) {
        setNavOpen(false);
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setNavOpen(false);
        toggle.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (nav.classList.contains('is-open') && window.innerWidth > 768) setNavOpen(false);
    });
  }

  // Copy email to clipboard
  document.querySelectorAll('.email-copy-btn').forEach(function (btn) {
    var status = btn.parentNode.querySelector('[role="status"]');
    var timer;
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function () {
        btn.classList.add('is-copied');
        btn.setAttribute('title', 'Copied!');
        if (status) status.textContent = 'Email address copied to clipboard';
        clearTimeout(timer);
        timer = setTimeout(function () {
          btn.classList.remove('is-copied');
          btn.setAttribute('title', 'Copy email address');
          if (status) status.textContent = '';
        }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {
          fallbackCopy(text) && done();
        });
      } else if (fallbackCopy(text)) {
        done();
      }
    });
  });

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }

  // Current year in the footer
  var year = document.getElementById('year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  // Subtle reveal on scroll — disabled when the user prefers reduced motion,
  // and content stays visible without JS (see the CSS .js guard).
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !revealEls.length) {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  } else if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.intersectionRatio >= 0.12) {
            entry.target.classList.add('is-visible');
          } else if (!entry.isIntersecting) {
            entry.target.classList.remove('is-visible');
          }
        });
      },
      { threshold: [0, 0.12] }
    );
    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  // Rive animations — loaded lazily when the canvas scrolls into view.
  var riveCanvases = document.querySelectorAll('canvas[data-rive-src]');
  if (riveCanvases.length && window.rive) {
    var riveInstances = [];

    // Feeds the current wind speed (m/s, 80 m above ground) from Open-Meteo into a number input.
    var setupLiveWind = function (canvas, instance, stateMachine, inputName) {
      var input = instance.stateMachineInputs(stateMachine).find(function (i) {
        return i.name === inputName;
      });
      if (!input) return;
      var url = 'https://api.open-meteo.com/v1/forecast?latitude=' +
        canvas.getAttribute('data-rive-lat') + '&longitude=' +
        canvas.getAttribute('data-rive-lon') + '&current=wind_speed_80m&wind_speed_unit=ms';

      var update = function () {
        fetch(url)
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(function (data) {
            input.value = Math.round(data.current.wind_speed_80m);
          })
          .catch(function (err) {
            console.error('Open-Meteo wind update failed:', err);
          });
      };

      update();
      setInterval(update, 15 * 60 * 1000);
    };

    // Clicking the canvas reveals a small form; its value is written into the named text run.
    var setupTextRunForm = function (canvas, instance, runName) {
      var form = document.createElement('form');
      form.className = 'rive-text-form';
      form.hidden = true;

      var field = document.createElement('input');
      field.type = 'text';
      field.maxLength = 24;
      field.placeholder = 'Your name';
      field.autocomplete = 'given-name';
      field.setAttribute('aria-label', 'Your name');

      var button = document.createElement('button');
      button.type = 'submit';
      button.textContent = 'Submit name';

      form.appendChild(field);
      form.appendChild(button);
      canvas.insertAdjacentElement('afterend', form);

      var close = function () {
        form.hidden = true;
        canvas.focus();
      };

      canvas.tabIndex = 0;
      canvas.style.cursor = 'pointer';
      var open = function () {
        form.hidden = false;
        field.focus();
        field.select();
      };
      canvas.addEventListener('click', open);
      canvas.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = field.value.trim();
        if (name) {
          // Trailing space matches the design-time value ("Stranger ").
          instance.setTextRunValue(runName, name + ' ');
        }
        close();
      });
      form.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
      });
    };

    var loadRive = function (canvas) {
      var stateMachine = canvas.getAttribute('data-rive-state-machine') || 'State Machine 1';
      var clickTrigger = canvas.getAttribute('data-rive-click-trigger');
      var textRun = canvas.getAttribute('data-rive-text-run');
      var windInput = canvas.getAttribute('data-rive-wind-input');
      var instance = new window.rive.Rive({
        src: canvas.getAttribute('data-rive-src'),
        canvas: canvas,
        autoplay: true,
        artboard: canvas.getAttribute('data-rive-artboard') || undefined,
        stateMachines: stateMachine,
        // Lets taps produce click events on mobile (and lets the page scroll over the canvas).
        isTouchScrollEnabled: canvas.hasAttribute('data-rive-touch-scroll'),
        layout: new window.rive.Layout({
          fit: window.rive.Fit.Contain,
          alignment: window.rive.Alignment.Center
        }),
        onLoad: function () {
          // Match the canvas to the artboard size (scaled down if the column is narrower).
          var b = instance.bounds;
          if (b) {
            var w = b.maxX - b.minX;
            var h = b.maxY - b.minY;
            canvas.style.width = w + 'px';
            canvas.style.aspectRatio = w + ' / ' + h;
          }
          instance.resizeDrawingSurfaceToCanvas();
          if (clickTrigger) {
            var input = instance.stateMachineInputs(stateMachine).find(function (i) {
              return i.name === clickTrigger;
            });
            if (input) {
              canvas.style.cursor = 'pointer';
              canvas.addEventListener('click', function () {
                input.fire();
              });
            }
          }
          if (textRun) setupTextRunForm(canvas, instance, textRun);
          if (windInput) setupLiveWind(canvas, instance, stateMachine, windInput);
        }
      });
      riveInstances.push(instance);
    };

    if ('IntersectionObserver' in window) {
      var riveObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            riveObserver.unobserve(entry.target);
            loadRive(entry.target);
          }
        });
      }, { rootMargin: '200px' });
      riveCanvases.forEach(function (canvas) { riveObserver.observe(canvas); });
    } else {
      riveCanvases.forEach(loadRive);
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        riveInstances.forEach(function (instance) {
          instance.resizeDrawingSurfaceToCanvas();
        });
      }, 100);
    });
  }
})();
