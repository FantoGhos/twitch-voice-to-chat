// Twitch Voice → Chat (Slate-safe, append-mode, autosend toggle)
(function () {
  const LANG = 'uk-UA';

  let recognition = null;
  let recording = false;
  let injected = false;

  let autoSend = true;
  let appendMode = true;

  /* ================= Speech ================= */

  function createRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const r = new SR();
    r.lang = LANG;
    r.interimResults = true;
    r.continuous = true;
    return r;
  }

  /* ================= Twitch ================= */

  const getInput = () =>
    document.querySelector('[data-a-target="chat-input"]');

  const getSendBtn = () =>
    document.querySelector('[data-a-target="chat-send-button"]');

  function focusInput(input) {
    input.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(input);
    r.collapse(false);
    sel.addRange(r);
  }

  /* ================= UA punctuation ================= */

  function applyUAPunctuation(text) {
    let t = text;

    const map = {
      ' кома': ',',
      ' крапка': '.',
      ' знак питання': '?',
      ' знак оклику': '!',
      ' двокрапка': ':',
      ' крапка з комою': ';'
    };

    for (const k in map) {
      t = t.replace(new RegExp(k, 'gi'), map[k]);
    }

    t = t.replace(/\bнова строка\b/gi, '\n');
    t = t.replace(/\bабзац\b/gi, '\n\n');

    t = t.replace(/([.!?]\s*)([а-яіїє])/g, (_, a, b) => a + b.toUpperCase());
    return t;
  }

  /* ================= Slate insert ================= */

  function insertText(text) {
    const input = getInput();
    if (!input || !input.isContentEditable) return;

    focusInput(input);

    if (!appendMode) {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
    }

    const dt = new DataTransfer();
    dt.setData('text/plain', text);

    input.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      })
    );

    // destroy zero-width
    input.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: ' ' })
    );
    document.execCommand('delete', false, null);

    console.log('[tv2c] inserted:', text);
  }

  function sendMessage() {
    const btn = getSendBtn();
    if (!btn) return;

    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    console.log('[tv2c] sent');
  }

  /* ================= Recording ================= */

  function start(btn, status, dot) {
    if (recording) return;

    recognition = createRecognition();
    if (!recognition) {
      status.textContent = 'Speech API недоступний';
      return;
    }

    recording = true;
    btn.classList.add('tv2c-active');
    dot.style.display = 'inline-block';
    status.textContent = '🎙️ Слухаю…';

    recognition.onresult = (e) => {
      let final = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript.trim() + ' ';
        }
      }

      if (final) {
        const text = applyUAPunctuation(final.trim());
        insertText(text + ' ');
        if (autoSend) sendMessage();
      }
    };

    recognition.onend = () => {
      if (recording) recognition.start();
    };

    recognition.start();
  }

  function stop(btn, status, dot) {
    recording = false;
    btn.classList.remove('tv2c-active');
    dot.style.display = 'none';
    status.textContent = '';

    try { recognition.stop(); } catch (_) {}
    recognition = null;
  }

  /* ================= UI ================= */

  function ensureUI() {
    if (injected) return;
    const input = getInput();
    if (!input) return;

    const micBtn = document.createElement('button');
    micBtn.textContent = '🎤';
    micBtn.title = 'Alt+V';
    micBtn.className = 'tv2c-btn';

    const sendToggle = document.createElement('button');
    sendToggle.textContent = '📩A';
    sendToggle.title = 'Автовідправлення';
    sendToggle.className = 'tv2c-btn tv2c-autosend';

    const dot = document.createElement('span');
    dot.className = 'tv2c-dot';
    dot.style.display = 'none';

    const status = document.createElement('span');
    status.className = 'tv2c-status';

    input.parentElement.append(micBtn, sendToggle, dot, status);

    micBtn.onclick = () =>
      recording ? stop(micBtn, status, dot) : start(micBtn, status, dot);

    micBtn.oncontextmenu = (e) => {
      e.preventDefault();
      appendMode = !appendMode;
      status.textContent = appendMode ? '✏️ Append mode' : '🧹 Replace mode';
      setTimeout(() => status.textContent = '', 1200);
    };

    sendToggle.onclick = () => {
      autoSend = !autoSend;
      sendToggle.textContent = autoSend ? '📩A' : '📩✖';
      status.textContent = autoSend
        ? 'Автовідправлення: ON'
        : 'Автовідправлення: OFF';
      setTimeout(() => status.textContent = '', 1200);
    };

    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        recording ? stop(micBtn, status, dot) : start(micBtn, status, dot);
      }
    });

    injected = true;
  }

  const obs = new MutationObserver(ensureUI);

  function boot() {
    ensureUI();
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState !== 'loading') boot();
  else window.addEventListener('DOMContentLoaded', boot);
})();
