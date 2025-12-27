// ===============================
// Twitch Voice → Chat (Stable)
// ===============================
(function () {
  'use strict';

  const RECO_LANG = 'uk-UA';
  let recognition = null;
  let isRecording = false;
  let injected = false;
  let autoSend = true;

  // ===============================
  // Utils
  // ===============================
  function log(...args) {
    console.log('[tv2c]', ...args);
  }

  function warn(...args) {
    console.warn('[tv2c]', ...args);
  }

  function error(...args) {
    console.error('[tv2c]', ...args);
  }

  // ===============================
  // Speech Recognition
  // ===============================
  function getRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = RECO_LANG;
    rec.interimResults = true;
    rec.continuous = false;
    return rec;
  }

  // ===============================
  // Twitch elements
  // ===============================
  function getChatInput() {
    return document.querySelector('[data-a-target="chat-input"]');
  }

  function getSendButton() {
    return document.querySelector('[data-a-target="chat-send-button"]');
  }

  // ===============================
  // UI Injection
  // ===============================
  function ensureUI() {
    if (injected) return;

    const input = getChatInput();
    if (!input || !input.parentElement) return;

    const btn = document.createElement('button');
    btn.className = 'tv2c-btn';
    btn.type = 'button';
    btn.title = 'Голос → Текст (Alt+V)';
    btn.textContent = autoSend ? '🎤📩' : '🎤';

    const status = document.createElement('span');
    status.className = 'tv2c-status';

    const dot = document.createElement('span');
    dot.className = 'tv2c-dot';
    dot.style.display = 'none';

    input.parentElement.appendChild(btn);
    input.parentElement.appendChild(dot);
    input.parentElement.appendChild(status);

    btn.addEventListener('click', () => toggleRecording(btn, status, dot));

    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      autoSend = !autoSend;
      btn.textContent = autoSend ? '🎤📩' : '🎤';
      status.textContent = autoSend
        ? 'Режим: Вставити + Надіслати'
        : 'Режим: лише Вставити';
      setTimeout(() => (status.textContent = ''), 2000);
    });

    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        toggleRecording(btn, status, dot);
      }
    });

    injected = true;
    log('UI injected');
  }

  // ===============================
  // CORE: Safe text insertion
  // ===============================
  function setChatText(text) {
    const input = document.querySelector('[data-a-target="chat-input"]');
    if (!input) {
      console.error('[tv2c] chat input NOT FOUND');
      return;
    }

    console.group('[tv2c] setChatText');
    console.log('text:', text);

    input.focus();

    // 1️⃣ Очистка
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);

    // 2️⃣ СТВОРЮЄМО paste event (КРИТИЧНО)
    const dt = new DataTransfer();
    dt.setData('text/plain', text);

    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    });

    input.dispatchEvent(pasteEvent);

    // 3️⃣ Fallback (якщо paste не спрацював)
    if (!input.innerText.trim()) {
      console.warn('[tv2c] paste fallback');
      for (const ch of text) {
        document.execCommand('insertText', false, ch);
      }
    }

    // 4️⃣ Примусовий keydown (Slate hook)
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: ' ',
      code: 'Space'
    }));
    document.execCommand('delete', false, null);

    // 5️⃣ Діагностика
    setTimeout(() => {
      console.log('innerText:', input.innerText);
      console.log(
        'zeroWidth:',
        input.querySelectorAll('[data-slate-zero-width]').length
      );
      console.groupEnd();
    }, 0);
  }

  // ===============================
  // Send message
  // ===============================
  function sendMessage() {
    const btn = getSendButton();
    if (!btn) {
      warn('send button NOT FOUND');
      return;
    }

    log('sending message');

    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function isSendEnabled() {
    const btn = getSendButton();
    if (!btn) return false;
    return !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
  }

  // ===============================
  // Recording logic
  // ===============================
  function toggleRecording(btn, status, dot) {
    if (isRecording) {
      stopRecording(btn, status, dot);
    } else {
      startRecording(btn, status, dot);
    }
  }

  function startRecording(btn, status, dot) {
    recognition = getRecognition();
    if (!recognition) {
      status.textContent = 'Web Speech API недоступний';
      return;
    }

    isRecording = true;
    btn.classList.add('tv2c-active');
    dot.style.display = 'inline-block';
    status.textContent = 'Запис…';

    recognition.onresult = (event) => {
      let finalText = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) {
          finalText += t + ' ';
        } else {
          interim = t;
        }
      }

      if (interim) {
        status.textContent = 'Запис… ' + interim;
      }

      if (finalText) {
        setChatText(finalText.trim());
        if (autoSend) {
          setTimeout(sendMessage, 80);
        }
      }
    };

    recognition.onerror = (e) => {
      error('speech error:', e.error);
      stopRecording(btn, status, dot);
    };

    recognition.onend = () => {
      if (isRecording) stopRecording(btn, status, dot);
    };

    try {
      recognition.start();
    } catch (e) {
      error('cannot start recognition', e);
      stopRecording(btn, status, dot);
    }
  }

  function stopRecording(btn, status, dot) {
    if (recognition) {
      try {
        recognition.stop();
      } catch (_) {}
      recognition = null;
    }
    isRecording = false;
    btn.classList.remove('tv2c-active');
    dot.style.display = 'none';
    status.textContent = '';
  }

  // ===============================
  // Boot
  // ===============================
  const observer = new MutationObserver(() => {
    ensureUI();
  });

  function boot() {
    ensureUI();
    observer.observe(document.body, { childList: true, subtree: true });
    log('booted');
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
