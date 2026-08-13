"use strict";

(() => {
  const HOST_ID = "__web2fig_capture_panel__";
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-web2fig-ignore", "true");
  host.style.cssText = "position:fixed;inset:0 auto auto 0;width:0;height:0;z-index:2147483647;";
  (document.body || document.documentElement).appendChild(host);
  const shadow = host.attachShadow({ mode: "closed" });

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .panel {
        position: fixed; top: 20px; right: 20px; width: 350px; overflow: hidden;
        color: #f1f5f9;
        background: linear-gradient(180deg, #161822 0%, #0d0e15 100%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(99, 102, 241, 0.15);
        font: 13px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: -0.01em; user-select: none;
        animation: panel-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes panel-in {
        from { opacity: 0; transform: translateY(-8px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      button { font: inherit; cursor: pointer; border: 0; background: none; }
      button:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; }

      .header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.02);
      }
      .brand-group { display: flex; align-items: center; gap: 10px; }
      .brand-icon {
        display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25));
        border: 1px solid rgba(129, 140, 248, 0.35);
        color: #a5b4fc;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
      }
      .brand-title { font-size: 13px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; }
      .status-pill {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 3px 8px; border-radius: 99px; font-size: 10px; font-weight: 600;
        background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); color: #94a3b8;
      }
      .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; }
      .status-pill.busy .status-dot { background: #f59e0b; animation: pulse 1s infinite alternate; }
      .status-pill.success .status-dot { background: #818cf8; }
      @keyframes pulse { from { opacity: 0.4; } to { opacity: 1; } }

      .icon-button {
        display: grid; place-items: center; width: 26px; height: 26px; border-radius: 6px;
        color: #64748b; transition: all 0.15s;
      }
      .icon-button:hover { color: #f1f5f9; background: rgba(255, 255, 255, 0.08); }

      .content { padding: 14px 16px; }

      .card-group { display: flex; flex-direction: column; gap: 8px; }
      
      .action-card {
        display: flex; align-items: center; gap: 12px;
        padding: 12px; border-radius: 12px; text-align: left;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        color: #f1f5f9;
      }
      .action-card:hover {
        background: rgba(99, 102, 241, 0.08);
        border-color: rgba(129, 140, 248, 0.3);
        transform: translateY(-1px);
      }
      .action-card:active { transform: translateY(0); }
      .action-card[disabled] { opacity: 0.5; pointer-events: none; }

      .card-icon-box {
        display: grid; place-items: center; width: 36px; height: 36px; border-radius: 9px;
        background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08);
        color: #cbd5e1; flex: 0 0 auto; transition: all 0.15s;
      }
      .action-card:hover .card-icon-box {
        background: rgba(99, 102, 241, 0.2);
        border-color: rgba(129, 140, 248, 0.4);
        color: #818cf8;
      }

      .card-body { flex: 1; min-width: 0; }
      .card-heading { display: flex; align-items: center; justify-content: space-between; }
      .card-title { font-size: 12.5px; font-weight: 650; color: #f8fafc; }
      .card-desc { font-size: 11px; color: #94a3b8; margin-top: 2px; line-height: 1.35; }
      .kbd-badge {
        font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
        padding: 2px 5px; border-radius: 4px;
        background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1);
        color: #64748b;
      }

      .status {
        display: none; margin-top: 10px; padding: 12px;
        border-radius: 10px; background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        animation: fade-in 0.15s ease-out;
      }
      .status.show { display: block; }
      @keyframes fade-in { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }

      .status-header { display: flex; align-items: flex-start; gap: 10px; }
      .spinner {
        width: 14px; height: 14px; flex: 0 0 auto; margin-top: 2px;
        border: 2px solid rgba(129, 140, 248, 0.25); border-top-color: #818cf8;
        border-radius: 50%; animation: spin 0.65s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      .status.success { background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.25); }
      .status.error { background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.25); }
      .status.cancelled { background: rgba(148, 163, 184, 0.08); border-color: rgba(148, 163, 184, 0.2); }
      .status.success .spinner, .status.error .spinner, .status.cancelled .spinner { display: none; }

      .status-title { font-size: 12px; font-weight: 650; color: #f8fafc; }
      .status.success .status-title { color: #34d399; }
      .status.error .status-title { color: #f87171; }
      .status-message { font-size: 11px; color: #94a3b8; margin-top: 2px; }

      .steps { display: flex; gap: 4px; margin-top: 10px; padding: 0; list-style: none; }
      .step { flex: 1; height: 3px; background: rgba(255, 255, 255, 0.08); border-radius: 99px; transition: background 0.2s; }
      .step.active, .step.done { background: #818cf8; }
      .status.success .step.done { background: #34d399; }

      .status-actions { display: flex; gap: 6px; margin-top: 10px; }
      .status-action {
        padding: 5px 9px; border-radius: 6px; font-size: 11px; font-weight: 600;
        color: #cbd5e1; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1);
        transition: all 0.12s;
      }
      .status-action:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
      .status-action.primary { background: rgba(99, 102, 241, 0.2); border-color: rgba(129, 140, 248, 0.35); color: #a5b4fc; }
      .status-action[hidden] { display: none; }

      .footer {
        display: flex; align-items: center; justify-content: space-between;
        margin-top: 12px; padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        font-size: 10.5px; color: #64748b;
      }
      .footer-meta { display: flex; align-items: center; gap: 5px; }

      /* Element Picker HUD */
      .selection-bar {
        display: none; position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
        align-items: center; gap: 10px; padding: 8px 14px;
        color: #f8fafc; background: rgba(13, 14, 21, 0.94); backdrop-filter: blur(12px);
        border: 1px solid rgba(129, 140, 248, 0.3); border-radius: 12px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
        font: 12px/1.3 Inter, ui-sans-serif, system-ui, sans-serif;
      }
      .selection-bar.show { display: flex; animation: bar-in 0.16s ease-out; }
      @keyframes bar-in { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      .selection-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.2); }
      .selection-copy strong { display: block; font-size: 11.5px; font-weight: 650; color: #fff; }
      .selection-copy span { display: block; font-size: 10.5px; color: #94a3b8; }
      .cancel-picker { padding: 4px 8px; border-radius: 5px; background: rgba(255, 255, 255, 0.08); color: #cbd5e1; font-size: 10.5px; }
      .cancel-picker:hover { background: rgba(255, 255, 255, 0.15); color: #fff; }

      /* In-page vector selection frame overlay */
      .highlight {
        position: fixed; display: none; pointer-events: none; z-index: 2147483646;
        border: 1.5px solid #818cf8; border-radius: 4px;
        background: rgba(99, 102, 241, 0.08);
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.2);
        transition: left 0.03s, top 0.03s, width 0.03s, height 0.03s;
      }
      .element-label {
        position: fixed; display: none; z-index: 2147483647; max-width: 280px;
        padding: 4px 8px; overflow: hidden; color: #f8fafc; border-radius: 6px;
        background: #0f172a; border: 1px solid rgba(129, 140, 248, 0.35);
        font: 10.5px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
        text-overflow: ellipsis; white-space: nowrap; pointer-events: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      }
      @media (max-width: 460px) {
        .panel { top: 10px; right: 10px; left: 10px; width: auto; }
        .selection-bar { min-width: 0; width: calc(100vw - 20px); bottom: 10px; }
      }
    </style>
    <section class="panel" aria-label="Web2Fig capture controls">
      <header class="header">
        <div class="brand-group">
          <span class="brand-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <path d="M3 9h18"/>
              <path d="M9 21V9"/>
            </svg>
          </span>
          <span class="brand-title">Web2Fig</span>
        </div>
        <div class="status-pill"><span class="status-dot"></span><span class="status-text">Ready</span></div>
        <button class="icon-button close-button" type="button" aria-label="Close Web2Fig">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m4 4 8 8M12 4l-8 8"/></svg>
        </button>
      </header>
      <main class="content">
        <div class="card-group">
          <button class="action-card page-button" type="button">
            <span class="card-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2"/>
                <path d="M7 8h10M7 12h6"/>
              </svg>
            </span>
            <div class="card-body">
              <div class="card-heading">
                <span class="card-title">Capture Entire Page</span>
                <kbd class="kbd-badge">1</kbd>
              </div>
              <div class="card-desc">Convert page layout into auto-layout frames</div>
            </div>
          </button>

          <button class="action-card element-button" type="button">
            <span class="card-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="7"/>
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              </svg>
            </span>
            <div class="card-body">
              <div class="card-heading">
                <span class="card-title">Inspect &amp; Pick Element</span>
                <kbd class="kbd-badge">2</kbd>
              </div>
              <div class="card-desc">Select any section, card, or DOM node</div>
            </div>
          </button>
        </div>

        <div class="status" role="status" aria-live="polite">
          <div class="status-header">
            <span class="spinner"></span>
            <div><span class="status-title"></span><span class="status-message"></span></div>
          </div>
          <ol class="steps" aria-label="Capture progress"><li class="step"></li><li class="step"></li><li class="step"></li></ol>
          <div class="status-actions">
            <button class="status-action cancel-capture" type="button" hidden>Cancel</button>
            <button class="status-action primary capture-another" type="button" hidden>Capture another</button>
            <button class="status-action done-button" type="button" hidden>Done</button>
          </div>
        </div>

        <footer class="footer">
          <div class="footer-meta">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            100% Local · Clipboard Only
          </div>
          <span>Esc to exit</span>
        </footer>
      </main>
    </section>

    <aside class="selection-bar" aria-live="polite">
      <span class="selection-dot"></span>
      <div class="selection-copy">
        <strong>Element Selection Mode</strong>
        <span>Hover over page elements and click to capture</span>
      </div>
      <kbd class="kbd-badge">Esc</kbd>
      <button class="cancel-picker" type="button">Cancel</button>
    </aside>
    <div class="highlight"></div><div class="element-label"></div>
  `;

  const panel = shadow.querySelector(".panel");
  const pageButton = shadow.querySelector(".page-button");
  const elementButton = shadow.querySelector(".element-button");
  const closeButton = shadow.querySelector(".close-button");
  const statusPill = shadow.querySelector(".status-pill");
  const statusText = shadow.querySelector(".status-text");
  const status = shadow.querySelector(".status");
  const statusTitle = shadow.querySelector(".status-title");
  const statusMessage = shadow.querySelector(".status-message");
  const steps = [...shadow.querySelectorAll(".step")];
  const cancelButton = shadow.querySelector(".cancel-capture");
  const anotherButton = shadow.querySelector(".capture-another");
  const doneButton = shadow.querySelector(".done-button");
  const selectionBar = shadow.querySelector(".selection-bar");
  const pickerCancel = shadow.querySelector(".cancel-picker");
  const highlight = shadow.querySelector(".highlight");
  const elementLabel = shadow.querySelector(".element-label");
  let selecting = false;
  let selectedElement = null;
  let captureRun = 0;
  let activeCapture = false;
  let cancelled = false;
  let progressTimers = [];
  let destroyed = false;

  pageButton.addEventListener("click", () => capture("html"));
  elementButton.addEventListener("click", startSelection);
  closeButton.addEventListener("click", () => activeCapture ? cancelAndClose() : destroy());
  cancelButton.addEventListener("click", cancelCapture);
  anotherButton.addEventListener("click", resetStatus);
  doneButton.addEventListener("click", destroy);
  pickerCancel.addEventListener("click", () => {
    stopSelection();
    setStatus("ready", "Element picker cancelled", "Choose a capture option whenever you’re ready.");
  });

  function setStatus(tone, title, message, activeStep = -1) {
    status.className = `status show ${tone}`;
    statusTitle.textContent = title;
    statusMessage.textContent = message;
    steps.forEach((step, index) => {
      step.classList.toggle("active", index === activeStep);
      step.classList.toggle("done", index < activeStep || tone === "success");
    });
    cancelButton.hidden = tone !== "progress";
    anotherButton.hidden = tone !== "success";
    doneButton.hidden = tone !== "success" && tone !== "error";

    if (tone === "progress") {
      statusPill.className = "status-pill busy";
      statusText.textContent = "Capturing...";
    } else if (tone === "success") {
      statusPill.className = "status-pill success";
      statusText.textContent = "Copied";
    } else {
      statusPill.className = "status-pill";
      statusText.textContent = "Ready";
    }
  }

  function resetStatus() {
    status.className = "status";
    statusPill.className = "status-pill";
    statusText.textContent = "Ready";
    steps.forEach((step) => step.className = "step");
  }

  function setBusy(isBusy) {
    activeCapture = isBusy;
    pageButton.disabled = isBusy;
    elementButton.disabled = isBusy;
  }

  function beginProgress(run) {
    clearProgressTimers();
    setStatus("progress", "Reading page layout…", "Collecting structure and computed CSS styles.", 0);
    progressTimers = [
      setTimeout(() => {
        if (run === captureRun && activeCapture && !cancelled) setStatus("progress", "Resolving visual assets…", "Processing images, SVGs, and vector layers.", 1);
      }, 700),
      setTimeout(() => {
        if (run === captureRun && activeCapture && !cancelled) setStatus("progress", "Encoding for Figma…", "Formatting clipboard payload.", 2);
      }, 2200)
    ];
  }

  function clearProgressTimers() {
    progressTimers.forEach(clearTimeout);
    progressTimers = [];
  }

  async function capture(selector) {
    if (activeCapture || !window.figma?.capturePage) {
      if (!window.figma?.capturePage) setStatus("error", "Capture engine unavailable", "Close Web2Fig and try opening it again on this page.");
      return;
    }

    stopSelection();
    resetStatus();
    setBusy(true);
    cancelled = false;
    const run = ++captureRun;
    beginProgress(run);

    try {
      const json = await window.figma.capturePage(selector);
      if (destroyed || cancelled || run !== captureRun) return;
      const assetSummary = summarizeAssets(json);
      setStatus("progress", "Copying to clipboard…", "Writing to OS clipboard.", 2);
      await window.figma.writeToClipboard(json);
      if (destroyed || cancelled || run !== captureRun) return;
      const assetMessage = assetSummary.total === 0
        ? "No image assets were detected. Open Figma canvas and paste with ⌘V or Ctrl+V."
        : `${assetSummary.copied} of ${assetSummary.total} image assets embedded. Paste with ⌘V or Ctrl+V.`;
      setStatus("success", "Captured & copied", assetMessage, 3);
    } catch (error) {
      if (!destroyed && run === captureRun && !cancelled) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus("error", "Capture failed", message);
      }
    } finally {
      clearProgressTimers();
      if (!destroyed && run === captureRun) {
        setBusy(false);
        if (cancelled) setStatus("cancelled", "Capture cancelled", "No payload was copied to clipboard.");
      }
    }
  }

  function summarizeAssets(json) {
    try {
      const assets = Object.values(JSON.parse(json).assets || {});
      return {
        total: assets.length,
        copied: assets.filter((asset) => Boolean(asset?.blob?.base64Blob)).length
      };
    } catch {
      return { total: 0, copied: 0 };
    }
  }

  function cancelCapture() {
    if (!activeCapture) return;
    cancelled = true;
    clearProgressTimers();
    setStatus("cancelled", "Cancelling…", "Web2Fig will discard current capture result.");
  }

  function cancelAndClose() {
    cancelled = true;
    clearProgressTimers();
    destroy();
  }

  function startSelection() {
    if (activeCapture || selecting) return;
    resetStatus();
    selecting = true;
    panel.style.display = "none";
    selectionBar.classList.add("show");
    document.addEventListener("mousemove", onPointerMove, true);
    document.addEventListener("click", onPointerClick, true);
    document.addEventListener("keydown", onSelectionKey, true);
  }

  function stopSelection() {
    if (!selecting) return;
    selecting = false;
    selectedElement = null;
    panel.style.display = "";
    selectionBar.classList.remove("show");
    highlight.style.display = "none";
    elementLabel.style.display = "none";
    document.removeEventListener("mousemove", onPointerMove, true);
    document.removeEventListener("click", onPointerClick, true);
    document.removeEventListener("keydown", onSelectionKey, true);
  }

  function eventIsExtensionUi(event) {
    return event.composedPath().includes(host);
  }

  function onPointerMove(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (!element || element === host || element.closest("[data-web2fig-ignore='true']")) {
      selectedElement = null;
      highlight.style.display = "none";
      elementLabel.style.display = "none";
      return;
    }
    selectedElement = element;
    const rect = element.getBoundingClientRect();
    highlight.style.cssText = `display:block;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`;
    const descriptor = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.classList.length ? `.${element.classList[0]}` : ""}`;
    elementLabel.textContent = `${descriptor}  ·  ${Math.round(rect.width)} × ${Math.round(rect.height)}px`;
    const labelLeft = Math.max(0, Math.min(rect.left, window.innerWidth - 280));
    elementLabel.style.cssText = `display:block;left:${labelLeft}px;top:${Math.max(0, rect.top - 26)}px;`;
  }

  function onPointerClick(event) {
    if (eventIsExtensionUi(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const element = selectedElement;
    stopSelection();
    if (!element) return;

    const attribute = "data-web2fig-target";
    const token = `w2f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const original = element.getAttribute(attribute);
    element.setAttribute(attribute, token);
    capture(`[${attribute}="${token}"]`).finally(() => {
      if (original === null) element.removeAttribute(attribute);
      else element.setAttribute(attribute, original);
    });
  }

  function onSelectionKey(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    stopSelection();
    setStatus("ready", "Element picker cancelled", "Choose a capture option whenever you’re ready.");
  }

  function destroy() {
    destroyed = true;
    clearProgressTimers();
    stopSelection();
    host.remove();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !selecting && !activeCapture) destroy();
    else if (event.key === "1" && !selecting && !activeCapture) capture("html");
    else if (event.key === "2" && !selecting && !activeCapture) startSelection();
  });
})();
