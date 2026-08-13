"use strict";

const api = chrome;
const RESTRICTED_PROTOCOLS = ["chrome:", "chrome-extension:", "edge:", "about:", "moz-extension:", "devtools:", "view-source:", "chrome-search:"];

api.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const url = tab.url || "";
  if (RESTRICTED_PROTOCOLS.some((protocol) => url.startsWith(protocol))) {
    console.warn("Web2Fig cannot capture browser-internal pages.");
    return;
  }

  if (url.startsWith("file:")) {
    const allowed = await api.extension.isAllowedFileSchemeAccess();
    if (!allowed) {
      console.warn("Web2Fig needs Allow access to file URLs enabled for local files.");
      return;
    }
  }

  try {
    await api.scripting.executeScript({
      target: { tabId: tab.id },
      func: installResourceBridge
    });
    await api.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      files: ["capture.js"]
    });
    await api.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      files: ["toolbar.js"]
    });
  } catch (error) {
    console.error("Web2Fig could not start on this page.", error);
  }
});

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "web2fig-fetch-image") return false;

  fetchImageAsBase64(message.url)
    .then(sendResponse)
    .catch((error) => sendResponse({ error: String(error) }));
  return true;
});

async function fetchImageAsBase64(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return { error: `HTTP ${response.status}` };

    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const dataUrl = `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
    return { dataUrl };
  } catch (error) {
    return { error: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function installResourceBridge() {
  if (window.__web2figResourceBridge) return;
  window.__web2figResourceBridge = true;

  window.addEventListener("message", async (event) => {
    const { source, type, url, requestId } = event.data || {};
    if (source !== "web2fig-page" || type !== "fetch-resource" || !url || !requestId) return;

    try {
      const result = await chrome.runtime.sendMessage({ type: "web2fig-fetch-image", url });
      window.postMessage({ source: "web2fig-extension", type: "fetch-resource-result", requestId, result }, "*");
    } catch (error) {
      window.postMessage({ source: "web2fig-extension", type: "fetch-resource-result", requestId, result: { error: String(error) } }, "*");
    }
  });
}
