/* =========================================================
   ANIMATIONS — reveal au scroll, nav active, barre de progression
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  // 1. Scroll-reveal via IntersectionObserver
  const revealTargets = document.querySelectorAll('.reveal, .reveal-stagger');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  revealTargets.forEach(el => revealObserver.observe(el));

  // 2. Nav link highlighting based on visible section
  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.navlinks a');
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.getAttribute('id');
      const link = document.querySelector(`.navlinks a[href="#${id}"]`);
      if (!link) return;
      if (entry.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(sec => navObserver.observe(sec));

  // 3. Scroll progress bar
  const progressBar = document.getElementById('scroll-progress');
  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + '%';
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  // 4. Nudge animation on the floating chat button
  const chatToggle = document.getElementById('chat-toggle');
  if (chatToggle) {
    setTimeout(() => {
      if (!document.getElementById('chat-panel').classList.contains('open')) {
        chatToggle.classList.add('nudge');
        setTimeout(() => chatToggle.classList.remove('nudge'), 600);
      }
    }, 4000);
  }

  // 5. Quick-start chips — auto-send in the section chat
  document.querySelectorAll('.qs-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.dataset.q;
      const input = document.getElementById('section-chat-input');
      if (input && sectionChat) {
        input.focus();
        sectionChat.send(q);
      }
    });
  });

});

/* =========================================================
   CHAT — appelle le backend sécurisé (jamais l'API directement)
   ========================================================= */

// URL de votre backend Render — remplacez par votre URL après déploiement.
// Ex : 'https://portfolio-chat-backend.onrender.com'
const BACKEND_URL = 'https://YOUR_BACKEND.onrender.com';

// Ping le backend au chargement pour le réveiller (Render free tier spin-down)
async function wakeBackend() {
  try {
    await fetch(BACKEND_URL + '/health', { method: 'GET' });
  } catch (_) {
    // Silencieux — pas critique si le ping échoue
  }
}
wakeBackend();

/* -------- Factory : crée un chat isolé (body, input, bouton envoi) -------- */
function createChat(bodyEl, inputEl, sendBtnEl) {
  const history = [];

  function addMsg(text, cls) {
    const div = document.createElement('div');
    div.className = 'chat-msg ' + cls;
    div.textContent = text;
    bodyEl.appendChild(div);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return div;
  }

  function addTyping() {
    const div = document.createElement('div');
    div.className = 'chat-msg bot typing';
    div.innerHTML = '<span>•</span><span>•</span><span>•</span>';
    bodyEl.appendChild(div);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return div;
  }

  async function send(text) {
    const msg = typeof text === 'string' ? text.trim() : '';
    if (!msg) return;

    // Limite côté client : 500 chars (miroir de la validation backend)
    if (msg.length > 500) {
      addMsg('Message trop long (max 500 caractères).', 'bot');
      return;
    }

    sendBtnEl.disabled = true;
    addMsg(msg, 'user');
    history.push({ role: 'user', content: msg });
    const typingEl = addTyping();

    try {
      const response = await fetch(BACKEND_URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // On envoie au maximum les 20 derniers messages pour limiter la taille
        body: JSON.stringify({ messages: history.slice(-20) }),
      });

      const data = await response.json();

      typingEl.remove();

      if (!response.ok) {
        // Message d'erreur explicite renvoyé par le backend (rate limit, validation…)
        addMsg(data.error || 'Une erreur est survenue.', 'bot');
        history.pop(); // annuler le message utilisateur de l'historique
        return;
      }

      if (data.reply) {
        addMsg(data.reply, 'bot');
        history.push({ role: 'assistant', content: data.reply });
      } else {
        addMsg('Pas de réponse — écris-moi à assia.megnounif2004@gmail.com !', 'bot');
        history.pop();
      }
    } catch (err) {
      console.error('[Chat error]', err);
      typingEl.remove();
      addMsg('Impossible de joindre l\'assistant — écris-moi à assia.megnounif2004@gmail.com !', 'bot');
      history.pop();
    } finally {
      sendBtnEl.disabled = false;
    }
  }

  function sendFromInput() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    send(text);
  }

  sendBtnEl.addEventListener('click', sendFromInput);
  inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendFromInput(); });

  return { send };
}

/* -------- Init des deux instances de chat -------- */
let sectionChat = null;

document.addEventListener('DOMContentLoaded', () => {

  // Chat section intégrée (principal)
  const sectionBody  = document.getElementById('section-chat-body');
  const sectionInput = document.getElementById('section-chat-input');
  const sectionSend  = document.getElementById('section-chat-send');
  if (sectionBody && sectionInput && sectionSend) {
    sectionChat = createChat(sectionBody, sectionInput, sectionSend);
  }

  // Chat flottant (accès rapide depuis n'importe où)
  const panel     = document.getElementById('chat-panel');
  const toggle    = document.getElementById('chat-toggle');
  const closeBtn  = document.getElementById('chat-close');
  const floatBody  = document.getElementById('chat-body');
  const floatInput = document.getElementById('chat-input');
  const floatSend  = document.getElementById('chat-send');

  if (panel && toggle) {
    toggle.addEventListener('click', () => panel.classList.toggle('open'));
    if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.remove('open'));
    if (floatBody && floatInput && floatSend) {
      createChat(floatBody, floatInput, floatSend);
    }
  }

});
