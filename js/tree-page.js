/**
 * Los Nombres del Bosque — Tree Page Interactivity
 * Handles: background loading, meditation player, ambient sound,
 * naming nudge, completion ritual, email capture, navigation.
 */

(function () {
  'use strict';

  // Get tree key from data attribute on <body>
  var treeKey = document.body.dataset.tree;
  if (!treeKey || !LNDB.trees[treeKey]) return;

  var tree = LNDB.trees[treeKey];
  var desc = LNDB.descriptions[treeKey];

  // Set accent color
  document.documentElement.style.setProperty('--accent', tree.accentColor);

  // Track tree page view
  window.lndbTrack('Tree Page View', { props: { tree: tree.name } });

  // ── Background photo loading ──
  var heroBg = document.querySelector('.tree-hero-bg');
  if (heroBg) {
    var bgImg = new Image();
    bgImg.onload = function () {
      heroBg.style.backgroundImage = 'url(' + bgImg.src + ')';
      heroBg.classList.add('loaded');
    };
    bgImg.src = '../assets/images/backgrounds/' + tree.backgroundFile;
  }

  // ── Illustration loading ──
  var heroIllustration = document.querySelector('.tree-hero-illustration');
  if (heroIllustration) {
    heroIllustration.onload = function () {
      heroIllustration.classList.add('loaded');
    };
    if (heroIllustration.complete) heroIllustration.classList.add('loaded');
  }

  // ── Scroll indicator ──
  var scrollBtn = document.querySelector('.tree-hero-scroll');
  if (scrollBtn) {
    scrollBtn.addEventListener('click', function () {
      var content = document.querySelector('.tree-content');
      if (content) content.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // ── Meditation audio player ──
  var playerSection = document.querySelector('.tree-player');
  if (playerSection && tree.hasMeditation) {
    var audio = new Audio('../assets/audio/meditations/' + treeKey + '.mp3');
    var playBtn = playerSection.querySelector('.tree-player-btn');
    var fill = playerSection.querySelector('.tree-player-fill');
    var timeEl = playerSection.querySelector('.tree-player-time');
    var playing = false;
    var meditationStarted = false;
    var milestones = {};

    function formatTime(s) {
      var m = Math.floor(s / 60);
      var sec = Math.floor(s % 60);
      return m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    if (playBtn) {
      playBtn.addEventListener('click', function () {
        if (playing) {
          audio.pause();
          window.lndbTrack('Meditation Paused', { props: { tree: tree.name, progress: Math.floor((audio.currentTime / (audio.duration || 1)) * 4) * 25 } });
          playBtn.textContent = '\u25B6';
          playing = false;
        } else {
          audio.play().then(function () {
            playBtn.textContent = '\u275A\u275A';
            playing = true;
            if (!meditationStarted) {
              meditationStarted = true;
              window.lndbTrack('Meditation Started', { props: { tree: tree.name } });
            }
          }).catch(function () { window.lndbTrack('Meditation Error', { props: { tree: tree.name, reason: 'playback' } }); });
        }
      });
    }

    audio.addEventListener('timeupdate', function () {
      if (audio.duration) {
        var pct = (audio.currentTime / audio.duration) * 100;
        [25, 50, 75].forEach(function (milestone) {
          if (pct >= milestone && !milestones[milestone]) {
            milestones[milestone] = true;
            window.lndbTrack('Meditation Progress', { props: { tree: tree.name, progress: milestone } });
          }
        });
        if (fill) fill.style.width = pct + '%';
        if (timeEl) timeEl.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
      }
    });

    audio.addEventListener('ended', function () {
      playing = false;
      if (playBtn) playBtn.textContent = '\u25B6';
      if (fill) fill.style.width = '100%';
      window.lndbTrack('Meditation Completed', { props: { tree: tree.name } });
      showCompletionRitual();
    });

    // Keyboard: Space/Enter to play/pause, arrows ±10s
    if (playBtn) {
      playBtn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { audio.currentTime = Math.min(audio.currentTime + 10, audio.duration || 0); e.preventDefault(); }
        if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(audio.currentTime - 10, 0); e.preventDefault(); }
      });
    }
  }

  // ── Ambient sound ──
  var soundToggle = document.querySelector('.tree-sound-toggle');
  var ambientAudio = null;

  if (soundToggle) {
    ambientAudio = new Audio('../assets/audio/ambient/' + tree.biome + '.mp3');
    ambientAudio.loop = true;
    ambientAudio.volume = 0.3;

    // Try autoplay muted
    ambientAudio.muted = true;
    var playPromise = ambientAudio.play();
    if (playPromise) {
      playPromise.then(function () {
        // Autoplay worked (muted). Show icon as muted.
        soundToggle.textContent = '\uD83D\uDD07';
        soundToggle.setAttribute('aria-label', 'Activar sonido ambiente');
      }).catch(function () {
        // Autoplay blocked
        soundToggle.textContent = '\uD83D\uDD08';
        soundToggle.classList.add('pulsing');
        soundToggle.setAttribute('aria-label', 'Activar sonido ambiente');
      });
    }

    soundToggle.addEventListener('click', function () {
      if (ambientAudio.muted || ambientAudio.paused) {
        ambientAudio.muted = false;
        ambientAudio.play().catch(function () {});
        soundToggle.textContent = '\uD83D\uDD0A';
        soundToggle.classList.remove('pulsing');
        soundToggle.setAttribute('aria-label', 'Silenciar sonido ambiente');
        window.lndbTrack('Sound Toggle', { props: { action: 'on', tree: tree.name } });
      } else {
        ambientAudio.muted = true;
        soundToggle.textContent = '\uD83D\uDD07';
        soundToggle.setAttribute('aria-label', 'Activar sonido ambiente');
        window.lndbTrack('Sound Toggle', { props: { action: 'off', tree: tree.name } });
      }
    });
  }

  // ── Completion ritual ──
  function showCompletionRitual() {
    var ritual = document.querySelector('.tree-ritual');
    if (!ritual) return;

    var msg = ritual.querySelector('.tree-ritual-msg');
    var actions = ritual.querySelector('.tree-ritual-actions');
    if (msg) msg.textContent = tree.completionMessage;

    // 3-second pause of stillness
    setTimeout(function () {
      ritual.classList.add('visible');

      // Show actions after 1 more second
      setTimeout(function () {
        if (actions) actions.classList.add('visible');
      }, 1000);
    }, 3000);

    // Dismiss by click/scroll/Escape
    function dismiss() {
      ritual.classList.remove('visible');
      if (actions) actions.classList.remove('visible');
      document.removeEventListener('keydown', onEsc);
    }

    function onEsc(e) {
      if (e.key === 'Escape') dismiss();
    }

    ritual.addEventListener('click', dismiss);
    document.addEventListener('keydown', onEsc);
  }

  // ── Naming nudge ──
  var fromQuiz = new URLSearchParams(window.location.search).get('from') === 'quiz';
  var nudgeDismissed = sessionStorage.getItem('nudge-dismissed-' + treeKey);

  if (!fromQuiz && !nudgeDismissed) {
    var nudge = document.querySelector('.tree-nudge');
    if (nudge) {
      setTimeout(function () {
        nudge.classList.add('visible');
        window.lndbTrack('Tree Nudge Viewed', { props: { tree: tree.name } });
      }, 15000);

      var dismissBtn = nudge.querySelector('.tree-nudge-dismiss');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', function () {
          window.lndbTrack('Tree Nudge Dismissed', { props: { tree: tree.name } });
          nudge.classList.remove('visible');
          sessionStorage.setItem('nudge-dismissed-' + treeKey, '1');
        });
      }

      // Escape to dismiss
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nudge.classList.contains('visible')) {
          window.lndbTrack('Tree Nudge Dismissed', { props: { tree: tree.name } });
          nudge.classList.remove('visible');
          sessionStorage.setItem('nudge-dismissed-' + treeKey, '1');
        }
      });
    }
  }

  // ── Email capture (MailerLite) ──
  var emailForm = document.querySelector('.tree-email-form');
  if (emailForm) {
    var submitBtn = emailForm.querySelector('.tree-email-submit');
    var msgEl = document.querySelector('.tree-email-msg');

    emailForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitBtn.disabled) return;

      var name = emailForm.querySelector('.tree-email-name').value;
      var email = emailForm.querySelector('.tree-email-input').value;
      var honeypot = emailForm.querySelector('.tree-email-honeypot');
      if (honeypot && honeypot.value) return; // bot

      window.lndbTrack('Signup Submitted', { props: { group: 'visita', tree: tree.name } });
      submitBtn.disabled = true;
      submitBtn.textContent = '...';

      fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          group: 'visita',
          tree: tree.name
        })
      }).then(function (r) {
        if (r.ok) {
          window.lndbTrack('Email Signup', { props: { tree: tree.name, source: 'tree', group: 'visita' } });
          if (msgEl) {
            msgEl.textContent = 'Gracias. Te avisaremos cuando sea el momento.';
            msgEl.className = 'tree-email-msg success';
          }
          submitBtn.textContent = 'Enviado';
        } else {
          throw new Error('fail');
        }
      }).catch(function () {
        window.lndbTrack('Signup Error', { props: { group: 'visita', reason: 'request_failed', tree: tree.name } });
        if (msgEl) {
          msgEl.textContent = 'No se pudo enviar. Intenta de nuevo.';
          msgEl.className = 'tree-email-msg error';
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar';
      });
    });
  }


  // Existing share buttons now share the canonical page and report the outcome.
  document.querySelectorAll('.tree-nudge-share, .tree-ritual-share').forEach(function (button) {
    button.addEventListener('click', async function () {
      var placement = button.matches('.tree-nudge-share') ? 'nudge' : 'completion';
      var props = { tree: tree.name, placement: placement };
      window.lndbTrack('Tree Share Click', { props: props });
      var url = location.origin + '/arboles/' + tree.slug;
      try {
        if (navigator.share) {
          await navigator.share({ title: tree.name + ' — Los Nombres del Bosque', url: url });
          window.lndbTrack('Share Result', { props: Object.assign({}, props, { method: 'native_link', outcome: 'shared' }) });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          button.textContent = 'Enlace copiado';
          setTimeout(function () { button.textContent = 'Compartir'; }, 3000);
          window.lndbTrack('Share Result', { props: Object.assign({}, props, { method: 'clipboard', outcome: 'copied' }) });
        } else {
          window.prompt('Copia este enlace para compartir tu árbol:', url);
          window.lndbTrack('Share Result', { props: Object.assign({}, props, { method: 'manual_copy', outcome: 'prompt_shown' }) });
        }
      } catch (err) {
        window.lndbTrack('Share Result', { props: Object.assign({}, props, { outcome: err.name === 'AbortError' ? 'cancelled' : 'error' }) });
      }
    });
  });

  // ── From-quiz fade-in ──
  if (fromQuiz) {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 1.5s ease';
    requestAnimationFrame(function () {
      document.body.style.opacity = '1';
    });
  }
})();
