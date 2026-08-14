document.addEventListener("DOMContentLoaded", () => {
  // Update dynamic copyright year
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // --- Mobile Drawer Toggle ---
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileDrawer = document.querySelector(".mobile-drawer");

  if (menuToggle && mobileDrawer) {
    menuToggle.addEventListener("click", () => {
      const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", !isOpen);
      mobileDrawer.classList.toggle("active");
      document.body.style.overflow = isOpen ? "" : "hidden";
    });

    // Close mobile drawer when clicking any link inside it
    mobileDrawer.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        menuToggle.setAttribute("aria-expanded", "false");
        mobileDrawer.classList.remove("active");
        document.body.style.overflow = "";
      });
    });
  }

  // --- Toast Notification Helper ---
  function showToast(message, duration = 3000) {
    let toast = document.querySelector(".global-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "global-toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      <span>${message}</span>
    `;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, duration);
  }

  // --- Copy Button Handlers ---
  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const codeSnippet = btn.closest(".code-card")?.querySelector("code, pre")?.textContent || btn.dataset.copy;
      if (codeSnippet) {
        navigator.clipboard.writeText(codeSnippet.trim()).then(() => {
          showToast("Copied to clipboard!");
        }).catch(err => {
          console.error("Clipboard copy failed:", err);
        });
      }
    });
  });

  // --- FAQ Search Filtering ---
  const faqInput = document.querySelector(".faq-search-input");
  const faqItems = document.querySelectorAll(".faq-item");

  if (faqInput && faqItems.length > 0) {
    faqInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase().trim();
      faqItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
          item.style.display = "";
        } else {
          item.style.display = "none";
        }
      });
    });
  }

  // --- Interactive Hero Simulator ---
  const simElements = document.querySelectorAll(".sim-element");
  const simTabs = document.querySelectorAll(".sim-tab");
  const simCaptureBtn = document.querySelector("#sim-capture-trigger");
  const simToast = document.querySelector(".capture-status-toast");

  if (simElements.length > 0) {
    // Hover / selection interaction
    simElements.forEach(el => {
      el.addEventListener("click", () => {
        simElements.forEach(item => item.classList.remove("selected"));
        el.classList.add("selected");
        const nodeName = el.querySelector(".sim-element-label")?.textContent || "Selected Element";
        if (simToast) {
          simToast.textContent = `Selected Figma node: ${nodeName}`;
          simToast.classList.add("show");
          setTimeout(() => simToast.classList.remove("show"), 2500);
        }
      });
    });

    // Tab Mode Toggle
    simTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        simTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const mode = tab.dataset.mode;
        if (mode === "full") {
          simElements.forEach(el => el.classList.remove("selected"));
          showToast("Mode: Full Page Capture Active");
        } else if (mode === "element") {
          simElements[0]?.classList.add("selected");
          showToast("Mode: Element Picker Hover Enabled");
        }
      });
    });

    // Capture Simulation Action
    if (simCaptureBtn) {
      simCaptureBtn.addEventListener("click", () => {
        const selected = document.querySelector(".sim-element.selected");
        const targetName = selected ? selected.querySelector(".sim-element-label")?.textContent : "Full Page DOM";
        
        simCaptureBtn.style.opacity = "0.7";
        simCaptureBtn.style.pointerEvents = "none";
        simCaptureBtn.innerHTML = `<span>Processing...</span>`;

        setTimeout(() => {
          simCaptureBtn.style.opacity = "";
          simCaptureBtn.style.pointerEvents = "";
          simCaptureBtn.innerHTML = `
            <div class="action-icon">▣</div>
            <div>
              <span class="action-title">Capture Entire Page</span>
              <span class="action-sub">Convert layout into editable frames</span>
            </div>
          `;
          showToast(`✨ Captured ${targetName}! Payload ready to paste into Figma (⌘V)`);
        }, 800);
      });
    }
  }
});
