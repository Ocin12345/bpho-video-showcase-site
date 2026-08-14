(() => {
  "use strict";

  const codeShotData = window.CODE_SHOTS;
  const shots = Array.isArray(codeShotData)
    ? codeShotData
    : Array.isArray(codeShotData?.shots)
      ? codeShotData.shots
      : [];
  const query = new URLSearchParams(window.location.search);
  const requestedTask = Number.parseInt(query.get("task") || "", 10);
  const recordMode = query.get("record") === "1";
  const individualMode = Number.isInteger(requestedTask) && requestedTask >= 1 && requestedTask <= shots.length;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const elements = {
    app: document.querySelector("#code-shot-app"),
    label: document.querySelector("[data-scene-label]"),
    description: document.querySelector("[data-scene-description]"),
    sourceFile: document.querySelector("[data-source-file]"),
    editorState: document.querySelector("[data-editor-state]"),
    codeFrame: document.querySelector("[data-code-frame]"),
    codeLines: document.querySelector("[data-code-lines]"),
    caption: document.querySelector("[data-scene-caption]"),
    progress: document.querySelector("[data-scene-progress]"),
    mode: document.querySelector("[data-sequence-mode]"),
    pause: document.querySelector('[data-control="pause"]'),
    previous: document.querySelector('[data-control="previous"]'),
    replay: document.querySelector('[data-control="replay"]'),
    next: document.querySelector('[data-control="next"]'),
  };

  const KEYWORDS = new Set([
    "as",
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "else",
    "export",
    "extends",
    "for",
    "from",
    "function",
    "if",
    "import",
    "in",
    "let",
    "new",
    "of",
    "return",
    "static",
    "switch",
    "throw",
    "try",
    "typeof",
    "var",
    "while",
  ]);
  const CONSTANTS = new Set(["Infinity", "NaN", "Number", "Object", "Array", "Math", "JSON", "Promise"]);
  const BUILTINS = new Set([
    "ArrayBuffer",
    "Float32Array",
    "Float64Array",
    "Int32Array",
    "Map",
    "Set",
    "String",
    "Uint32Array",
    "document",
    "window",
  ]);

  let currentIndex = individualMode ? requestedTask - 1 : 0;
  let runToken = 0;
  let paused = false;
  let playing = false;
  let lineNodes = new Map();

  document.body.classList.toggle("record-mode", recordMode);
  if (!shots.length) {
    document.body.innerHTML = "<p style=\"padding:2rem;font:1rem system-ui;color:white\">Code-shot data is missing. Run generate-code-shot-data.mjs first.</p>";
    return;
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function tokenClass(token, source, endIndex) {
    if (token.startsWith("//") || token.startsWith("/*")) return "token-comment";
    if (/^(?:["'`])/.test(token)) return "token-string";
    if (/^(?:\d|\.\d)/.test(token)) return "token-number";
    if (KEYWORDS.has(token)) return "token-keyword";
    if (CONSTANTS.has(token)) return "token-constant";
    if (BUILTINS.has(token)) return "token-builtin";
    if (/^[A-Za-z_$][\w$]*$/.test(token) && /^\s*\(/.test(source.slice(endIndex))) {
      return "token-function";
    }
    return "";
  }

  function highlightJavaScript(source) {
    const tokenPattern = /(\/\/.*$|\/\*[\s\S]*?\*\/|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|[A-Za-z_$][\w$]*)/gm;
    let output = "";
    let cursor = 0;
    for (const match of source.matchAll(tokenPattern)) {
      const token = match[0];
      const start = match.index ?? cursor;
      output += escapeHtml(source.slice(cursor, start));
      const className = tokenClass(token, source, start + token.length);
      output += className
        ? `<span class=\"${className}\">${escapeHtml(token)}</span>`
        : escapeHtml(token);
      cursor = start + token.length;
    }
    return output + escapeHtml(source.slice(cursor));
  }

  function frameHeight() {
    return elements.codeFrame?.clientHeight || 1;
  }

  function lineCenter(line) {
    return line.offsetTop + line.offsetHeight / 2;
  }

  function targetScrollFor(lines) {
    const activeNodes = lines
      .map((line) => lineNodes.get(line))
      .filter(Boolean);
    if (!activeNodes.length) return 0;
    const top = Math.min(...activeNodes.map((line) => lineCenter(line)));
    const bottom = Math.max(...activeNodes.map((line) => lineCenter(line)));
    const midpoint = (top + bottom) / 2;
    const maxScroll = Math.max(0, elements.codeLines.scrollHeight - elements.codeLines.clientHeight);
    return Math.min(maxScroll, Math.max(0, midpoint - frameHeight() / 2));
  }

  function renderSegment(segment) {
    elements.sourceFile.textContent = segment.source;
    elements.codeLines.replaceChildren();
    lineNodes = new Map();
    for (const sourceLine of segment.lines) {
      const line = document.createElement("div");
      line.className = "code-line";
      line.dataset.lineNumber = String(sourceLine.number);
      line.dataset.sourceText = sourceLine.text;
      line.setAttribute("role", "listitem");

      const text = document.createElement("span");
      text.className = "code-line__text";
      text.innerHTML = highlightJavaScript(sourceLine.text);
      line.append(text);
      elements.codeLines.append(line);
      lineNodes.set(sourceLine.number, line);
    }
    elements.codeLines.scrollTop = 0;
  }

  function setActiveLines(lines) {
    for (const line of lineNodes.values()) line.classList.remove("is-active");
    for (const lineNumber of lines) lineNodes.get(lineNumber)?.classList.add("is-active");
  }

  function updateCaption(caption) {
    elements.caption.textContent = caption;
  }

  function updateSceneMeta(shot) {
    elements.label.textContent = shot.label;
    elements.description.textContent = shot.description;
    elements.progress.textContent = `Task ${String(shot.task).padStart(2, "0")} / ${shots.length}`;
    elements.mode.textContent = individualMode ? "INDIVIDUAL SCENE" : "MASTER SEQUENCE";
    document.title = `BPhO 2026 · ${shot.label}`;
  }

  function nextFrame() {
    return new Promise((resolve) => window.requestAnimationFrame(resolve));
  }

  async function waitForDuration(durationMs, token) {
    let remaining = durationMs;
    let previousTime = performance.now();
    while (remaining > 0) {
      await nextFrame();
      if (token !== runToken) return false;
      const now = performance.now();
      if (!paused) {
        remaining -= Math.max(0, now - previousTime);
      }
      previousTime = now;
    }
    return token === runToken;
  }

  async function scrollToFocus(lines, token, maximumDuration) {
    const target = targetScrollFor(lines);
    if (reducedMotion.matches && !recordMode) {
      elements.codeLines.scrollTop = target;
      return { completed: token === runToken, elapsedMs: 0 };
    }

    const start = elements.codeLines.scrollTop;
    const distance = target - start;
    if (Math.abs(distance) < 1) return { completed: token === runToken, elapsedMs: 0 };
    const duration = Math.min(maximumDuration, Math.max(160, Math.abs(distance) * 0.7));
    let elapsed = 0;
    let previousTime = performance.now();
    while (elapsed < duration) {
      await nextFrame();
      if (token !== runToken) return { completed: false, elapsedMs: elapsed };
      const now = performance.now();
      if (!paused) elapsed += Math.max(0, now - previousTime);
      previousTime = now;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - (1 - progress) ** 3;
      elements.codeLines.scrollTop = start + distance * eased;
    }
    elements.codeLines.scrollTop = target;
    return { completed: token === runToken, elapsedMs: duration };
  }

  async function playSegment(segment, token) {
    renderSegment(segment);
    for (const phase of segment.phases) {
      if (token !== runToken) return false;
      setActiveLines(phase.lines);
      updateCaption(phase.caption);
      const scrollResult = await scrollToFocus(
        phase.lines,
        token,
        Math.min(520, phase.durationMs * 0.42),
      );
      if (!scrollResult.completed) return false;
      const held = await waitForDuration(
        Math.max(0, phase.durationMs - scrollResult.elapsedMs),
        token,
      );
      if (!held) return false;
    }
    return true;
  }

  async function playShot(index, token) {
    const shot = shots[index];
    updateSceneMeta(shot);
    for (const segment of shot.segments) {
      const completed = await playSegment(segment, token);
      if (!completed) return false;
    }
    return token === runToken;
  }

  function updatePauseButton() {
    if (!elements.pause) return;
    elements.pause.innerHTML = paused
      ? '<span aria-hidden="true">▶</span> Resume'
      : '<span aria-hidden="true">Ⅱ</span> Pause';
    elements.pause.setAttribute("aria-pressed", paused ? "true" : "false");
  }

  async function playFrom(index, { restart = true } = {}) {
    currentIndex = Math.min(shots.length - 1, Math.max(0, index));
    runToken += 1;
    const token = runToken;
    paused = false;
    playing = true;
    updatePauseButton();
    const completed = await playShot(currentIndex, token);
    if (!completed || token !== runToken) return;

    if (!individualMode && currentIndex < shots.length - 1) {
      const transitionComplete = await waitForDuration(140, token);
      if (!transitionComplete || token !== runToken) return;
      currentIndex += 1;
      await playFrom(currentIndex, { restart: false });
      return;
    }

    playing = false;
    paused = false;
    updatePauseButton();
  }

  function navigateTo(index) {
    playFrom((index + shots.length) % shots.length);
  }

  elements.previous.addEventListener("click", () => navigateTo(currentIndex - 1));
  elements.next.addEventListener("click", () => navigateTo(currentIndex + 1));
  elements.replay.addEventListener("click", () => playFrom(currentIndex));
  elements.pause.addEventListener("click", () => {
    if (!playing) {
      playFrom(currentIndex);
      return;
    }
    paused = !paused;
    updatePauseButton();
  });

  if (recordMode) {
    elements.editorState.textContent = "SOURCE EXCERPT · READ ONLY";
  }

  updateSceneMeta(shots[currentIndex]);
  playFrom(currentIndex);
})();
