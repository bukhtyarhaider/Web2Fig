"use strict";
(() => {
  // src/lib/media/resolver.ts
  var UNSUPPORTED_IMAGE_TYPES = /* @__PURE__ */ new Set(["image/avif", "image/heif", "image/heic"]);
  var RESOURCE_TIMEOUT = 25e3;
  var IMAGE_DECODE_TIMEOUT = 5e3;
  var BRIDGE_TIMEOUT = 2e4;
  var MAX_CONCURRENT_ASSET_FETCHES = 6;
  var CaptureError = class extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
      this.name = "CaptureError";
    }
  };
  var ResourceResolver = class {
    constructor(options) {
      this.promises = /* @__PURE__ */ new Map();
      /** Auto-incrementing counter used to mint `rasterized:N` pseudo-URLs. */
      this.rasterizedId = 0;
      this.pendingTasks = [];
      this.activeTasks = 0;
      this.options = options;
    }
    /**
     * Register an in-flight promise under `url`.
     *
     * If the promise rejects the rejection is caught and turned into
     * `{ url, blob: null, error }` so that `getBlobMap` never throws.
     */
    addPromise(url, promise) {
      this.promises.set(
        url,
        promise.catch((error) => ({
          url,
          blob: null,
          error: String(error)
        }))
      );
    }
    enqueue(task) {
      return new Promise((resolve, reject) => {
        this.pendingTasks.push({ task, resolve, reject });
        this.drainQueue();
      });
    }
    drainQueue() {
      while (this.activeTasks < MAX_CONCURRENT_ASSET_FETCHES && this.pendingTasks.length > 0) {
        const entry = this.pendingTasks.shift();
        this.activeTasks += 1;
        withTimeout(Promise.resolve().then(entry.task), RESOURCE_TIMEOUT, "Timed out while reading image asset").then(entry.resolve, entry.reject).finally(() => {
          this.activeTasks -= 1;
          this.drainQueue();
        });
      }
    }
    /**
     * Enqueue an image URL for fetching.
     *
     * Duplicate URLs and empty strings are silently ignored.  When
     * `skipRemoteAssetSerialization` is set and the URL points to a
     * remote host, the blob is skipped (only the URL is recorded).
     *
     * If a source `<img>` element is provided, it will be used for direct
     * canvas rasterization — bypassing CORS entirely since the browser has
     * already loaded and decoded the image.
     */
    addImage(rawUrl, sourceElement) {
      if (!rawUrl) return;
      let url = rawUrl;
      try {
        if (!url.startsWith("data:") && !url.startsWith("blob:") && !url.startsWith("rasterized:")) {
          url = new URL(url, window.location.href).href;
        }
      } catch {
      }
      if (this.promises.has(url)) return;
      const promise = this.options.skipRemoteAssetSerialization && isRemoteUrl(url) ? Promise.resolve({ url, blob: null }) : this.enqueue(() => fetchImageAsBlob(url, sourceElement));
      this.addPromise(url, promise);
    }
    /**
     * Rasterize a `<canvas>` element to PNG and register it under a
     * synthetic `rasterized:N` URL.
     */
    addCanvas(canvas) {
      const url = this.getRasterizedImageUrl();
      const promise = withTimeout(canvasToBlob(canvas), RESOURCE_TIMEOUT, "Timed out while rasterizing canvas").then((blob) => ({ url, blob }));
      this.addPromise(url, promise);
      return url;
    }
    /**
     * Capture the current frame of a `<video>` element.
     */
    addVideo(video) {
      const currentSrc = video.currentSrc;
      if (!currentSrc || this.promises.has(currentSrc)) return;
      const promise = withTimeout(captureVideoFrame(video), RESOURCE_TIMEOUT, "Timed out while capturing video frame").then((blob) => ({
        url: currentSrc,
        blob
      }));
      this.addPromise(currentSrc, promise);
    }
    /**
     * Mint a new `rasterized:N` pseudo-URL.
     */
    getRasterizedImageUrl() {
      return `rasterized:${this.rasterizedId++}`;
    }
    /**
     * Await every registered promise and return the results as a Map.
     */
    async getBlobMap() {
      const blobMap = /* @__PURE__ */ new Map();
      for (const [url, promise] of this.promises.entries()) {
        const result = await promise;
        blobMap.set(url, result);
      }
      return blobMap;
    }
  };
  function withTimeout(promise, timeout, message) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeout);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
  }
  function resolveResources(element, computedStyle, assetCollector) {
    collectImageElement(element, assetCollector);
    collectVideoElement(element, assetCollector);
    collectBackgroundImages(assetCollector, computedStyle);
  }
  function isRemoteUrl(url) {
    if (url.startsWith("data:") || url.startsWith("blob:")) return false;
    if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("//")) {
      return isRemoteUrl(window.location.href);
    }
    try {
      const hostname = new URL(url, window.location.href).hostname;
      return !(hostname === "0.0.0.0" || hostname === "localhost" || hostname.startsWith("127.") || hostname === "[::1]" || hostname === "::1" || hostname.endsWith(".local"));
    } catch {
      return false;
    }
  }
  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        blob ? resolve(blob) : reject(new Error("Failed to create blob from canvas"));
      }, "image/png");
    });
  }
  function collectBackgroundImages(assetCollector, computedStyle) {
    // CSS accepts quoted, unquoted, and multi-layer URL values. Preserve every
    // referenced image instead of only matching url("…") background syntax.
    const imageValues = [
      computedStyle.backgroundImage,
      computedStyle.borderImageSource,
      computedStyle.maskImage,
      computedStyle.webkitMaskImage,
      computedStyle.content
    ];
    for (const imageValue of imageValues) {
      if (!imageValue || imageValue === "none") continue;
      const matches = imageValue.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g);
      for (const match of matches) {
        const url = match[2]?.trim();
        if (url) assetCollector.addImage(url);
      }
    }
  }
  function collectImageElement(element, assetCollector) {
    if (element instanceof HTMLImageElement) {
      assetCollector.addImage(element.currentSrc, element);
    }
  }
  function collectVideoElement(element, assetCollector) {
    if (!(element instanceof HTMLVideoElement)) return;
    if (element.poster) {
      assetCollector.addImage(element.poster);
    }
    if (element.currentSrc && !shouldSkipVideo(element)) {
      assetCollector.addVideo(element);
    }
  }
  function shouldSkipVideo(video) {
    if (!video.poster) return false;
    return video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.currentTime === 0 && video.paused;
  }
  async function fetchImageAsBlob(url, sourceElement) {
    const sameOrigin = isSameOrigin(url);
    if (sameOrigin) {
      if (sourceElement && sourceElement.naturalWidth > 0 && sourceElement.complete) {
        try {
          const blob = await rasterizeLoadedImage(sourceElement);
          return { url, blob };
        } catch {
        }
      }
      let timer = null;
      try {
        const controller = new AbortController();
        timer = setTimeout(() => controller.abort(), RESOURCE_TIMEOUT);
        const response = await fetch(url, { signal: controller.signal });
        if (response.ok) {
          let blob = await response.blob();
          if (UNSUPPORTED_IMAGE_TYPES.has(blob.type)) {
            blob = await convertUnsupportedImage(blob);
          }
          return { url, blob };
        }
      } catch {
      } finally {
        if (timer !== null) clearTimeout(timer);
      }
      return { url, blob: null, error: `Failed to fetch same-origin image: ${url}` };
    }
    try {
      const blob = await fetchViaExtensionBridge(url);
      if (blob) return { url, blob };
    } catch {
    }
    if (sourceElement && sourceElement.naturalWidth > 0 && sourceElement.complete) {
      try {
        const blob = await rasterizeLoadedImage(sourceElement);
        return { url, blob };
      } catch {
      }
    }
    const existingImg = findLoadedImageOnPage(url);
    if (existingImg) {
      try {
        const blob = await rasterizeLoadedImage(existingImg);
        return { url, blob };
      } catch {
      }
    }
    return { url, blob: null, error: `Cross-origin image could not be read: ${url}` };
  }
  function fetchViaExtensionBridge(url) {
    return new Promise((resolve, reject) => {
      const callbackId = `web2fig-fetch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timeout = setTimeout(() => {
        cleanup();
        resolve(null);
      }, BRIDGE_TIMEOUT);
      function onResult(event) {
        const detail = event.data;
        if (detail?.source !== "web2fig-extension" || detail?.type !== "fetch-resource-result" || detail?.requestId !== callbackId) return;
        cleanup();
        if (detail.result?.error) {
          reject(new Error(detail.result.error));
          return;
        }
        if (detail.result?.dataUrl) {
          fetch(detail.result.dataUrl).then((r) => r.blob()).then(resolve).catch(reject);
        } else {
          resolve(null);
        }
      }
      function cleanup() {
        clearTimeout(timeout);
        window.removeEventListener("message", onResult);
      }
      window.addEventListener("message", onResult);
      window.postMessage({ source: "web2fig-page", type: "fetch-resource", url, requestId: callbackId }, "*");
    });
  }
  function rasterizeLoadedImage(img) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return Promise.reject(new Error("Failed to get canvas context"));
    }
    ctx.drawImage(img, 0, 0);
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          blob ? resolve(blob) : reject(new Error("toBlob returned null"));
        }, "image/png");
      } catch (e) {
        reject(e);
      }
    });
  }
  function findLoadedImageOnPage(url) {
    const images = document.querySelectorAll("img");
    for (const img of images) {
      if ((img.currentSrc === url || img.src === url) && img.complete && img.naturalWidth > 0) {
        return img;
      }
    }
    return null;
  }
  async function convertUnsupportedImage(blob) {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = objectUrl;
      await withTimeout(image.decode(), IMAGE_DECODE_TIMEOUT, "Timed out while decoding image");
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get canvas context for image conversion");
      }
      ctx.drawImage(image, 0, 0);
      return await canvasToBlob(canvas);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  function isSameOrigin(url) {
    try {
      return new URL(url, window.location.href).origin === window.location.origin;
    } catch {
      return false;
    }
  }
  async function loadCrossOriginVideo(video) {
    const src = video.currentSrc ?? video.src;
    if (isSameOrigin(src) || video.crossOrigin !== null) return null;
    const clonedVideo = document.createElement("video");
    clonedVideo.crossOrigin = "anonymous";
    clonedVideo.src = src;
    clonedVideo.muted = true;
    clonedVideo.preload = "auto";
    clonedVideo.style.position = "absolute";
    clonedVideo.style.visibility = "hidden";
    clonedVideo.style.pointerEvents = "none";
    return new Promise((resolve, reject) => {
      const targetTime = video.currentTime;
      let seeked = false;
      let frameReady = false;
      let frameCallbackId = null;
      const timeout = setTimeout(onTimeout, 1e4);
      clonedVideo.addEventListener("error", onError);
      if (targetTime === 0) {
        seeked = true;
        frameCallbackId = clonedVideo.requestVideoFrameCallback(onFrameReady);
        clonedVideo.play().then(() => clonedVideo.pause()).catch(onError);
      } else if (clonedVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
        seekToTarget();
      } else {
        clonedVideo.addEventListener("loadedmetadata", seekToTarget, {
          once: true
        });
      }
      function seekToTarget() {
        clonedVideo.currentTime = targetTime;
        clonedVideo.addEventListener("seeked", onSeeked, { once: true });
        frameCallbackId = clonedVideo.requestVideoFrameCallback(onFrameReady);
      }
      function onFrameReady() {
        frameReady = true;
        maybeResolve();
      }
      function onSeeked() {
        seeked = true;
        maybeResolve();
      }
      function maybeResolve() {
        if (seeked && frameReady) {
          cleanup();
          resolve(clonedVideo);
        }
      }
      function cleanup() {
        clearTimeout(timeout);
        clonedVideo.removeEventListener("error", onError);
        clonedVideo.removeEventListener("loadedmetadata", seekToTarget);
        clonedVideo.removeEventListener("seeked", onSeeked);
        if (frameCallbackId !== null) {
          clonedVideo.cancelVideoFrameCallback(frameCallbackId);
        }
      }
      function onError() {
        const errorCode = clonedVideo.error?.code;
        const errorMessage = clonedVideo.error?.message;
        const err = new Error(
          `Video error: code: ${errorCode}, message: ${errorMessage} (readyState: ${clonedVideo.readyState})`
        );
        cleanup();
        cleanupVideo(clonedVideo);
        reject(err);
      }
      function onTimeout() {
        cleanup();
        cleanupVideo(clonedVideo);
        reject(new CaptureError("Video loading timeout", "VIDEO_TIMEOUT"));
      }
    });
  }
  function cleanupVideo(video) {
    video.src = "";
  }
  async function captureVideoFrame(video) {
    const crossOriginVideo = await loadCrossOriginVideo(video);
    const sourceVideo = crossOriginVideo ?? video;
    try {
      if (sourceVideo.videoWidth === 0 || sourceVideo.videoHeight === 0) {
        throw new Error("Video has invalid dimensions");
      }
      const canvas = document.createElement("canvas");
      canvas.width = sourceVideo.videoWidth;
      canvas.height = sourceVideo.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get canvas context");
      }
      ctx.drawImage(sourceVideo, 0, 0);
      return canvasToBlob(canvas);
    } finally {
      if (crossOriginVideo) {
        cleanupVideo(crossOriginVideo);
      }
    }
  }

  // src/lib/encoding.ts
  async function uint8ArrayToDataUrl(data) {
    return new Promise((resolve, reject) => {
      const reader = Object.assign(new FileReader(), {
        onload: () => resolve(reader.result),
        onerror: () => reject(reader.error)
      });
      reader.readAsDataURL(
        new File([data], "", { type: "application/octet-stream" })
      );
    });
  }
  async function blobToBase64Object(blob) {
    if (blob == null) return null;
    const arrayBuffer = await blob.arrayBuffer();
    const dataUrl = await uint8ArrayToDataUrl(new Uint8Array(arrayBuffer));
    return {
      type: blob.type,
      base64Blob: dataUrl
    };
  }
  async function treeToJson(tree) {
    const serializedAssets = {};
    for (const [key, asset] of tree.assets.entries()) {
      serializedAssets[key] = {
        ...asset,
        blob: await blobToBase64Object(asset.blob)
      };
    }
    return JSON.stringify({
      ...tree,
      assets: serializedAssets,
      fonts: tree.fonts
    });
  }
  async function wrapForClipboard(jsonString) {
    const dataUrl = await uint8ArrayToDataUrl(
      new TextEncoder().encode(jsonString)
    );
    const base64Payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const openTag = "<!--(figh2d)";
    const closeTag = "(/figh2d)-->";
    const html = '<span data-h2d="' + openTag + base64Payload + closeTag + '"></span>';
    return new Blob([html], { type: "text/html" });
  }

  // src/lib/react/fiber.ts
  var DATA_FG_PREFIX = "data-fg-";
  function isFigmaAttribute(name) {
    return name.startsWith(DATA_FG_PREFIX);
  }
  function getReactFiber(element) {
    if (!element) return void 0;
    for (const key in element) {
      if (key.startsWith("__reactFiber")) {
        return element[key];
      }
    }
    return void 0;
  }
  function getFiberProps(fiber) {
    if (!fiber) return void 0;
    const props = fiber.pendingProps ?? fiber.memoizedProps;
    if (!props) return void 0;
    const propsCopy = { ...props };
    delete propsCopy.children;
    return propsCopy;
  }
  function parseSourceAnnotation(sourceId, value) {
    if (typeof value !== "string" || !sourceId) return void 0;
    const parts = value.split(":");
    const fileGuid = parts[0].replace(/\./g, ":");
    const fileVersion = parts[1] ? "[" + parts[1].replace(/\./g, ":") + "]" : "";
    const filePath = parts[2];
    const line = Number(parts[3]);
    const column = Number(parts[4]);
    const pos = Number(parts[5]);
    const len = Number(parts[6]);
    const annotationType = parts[7];
    switch (annotationType) {
      case "e":
        return {
          type: "element",
          sourceId,
          fileGuid,
          filePath,
          fileVersion,
          line,
          column,
          pos,
          len,
          name: parts[8],
          childTypes: parts[9] ? parts[9] === "_" ? [] : parts[9].split("") : void 0,
          isComponentDefinition: parts[10] === "1" ? true : void 0,
          assetKey: parts[11] ? parts[11] : void 0,
          makeLibraryId: parts[12] ? parts[12] : void 0,
          libraryId: parts[13] ? parts[13] : void 0,
          componentId: parts[14] ? parts[14] : void 0,
          isLibraryInstance: parts[15] === "1" ? true : void 0
        };
      case "t":
        return {
          type: "text",
          sourceId,
          fileGuid,
          filePath,
          fileVersion,
          line,
          column,
          pos,
          len
        };
      case "x":
        return {
          type: "expression",
          sourceId,
          fileGuid,
          filePath,
          fileVersion,
          line,
          column,
          pos,
          len
        };
      default:
        return void 0;
    }
  }
  function collectSourceAnnotations(props) {
    const annotations = [];
    if (!props) return annotations;
    for (const [attrName, attrValue] of Object.entries(props)) {
      if (!isFigmaAttribute(attrName) || typeof attrValue !== "string") continue;
      const segments = attrName.split("-");
      if (segments.length === 3) {
        const sourceId = segments[2];
        const annotation = parseSourceAnnotation(sourceId, attrValue);
        if (annotation) {
          annotations.push(annotation);
        }
      }
    }
    return annotations;
  }
  function getSourceAnnotations(element) {
    const fiber = getReactFiber(element);
    if (fiber) {
      const props = getFiberProps(fiber);
      if (props) {
        const annotations = collectSourceAnnotations(props);
        if (annotations.length > 0) return annotations;
      }
    }
    if (element?.attributes) {
      const annotations = [];
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        if (attr?.name.startsWith(DATA_FG_PREFIX)) {
          const sourceId = attr.name.split("-")[2];
          const annotation = parseSourceAnnotation(sourceId, attr.value);
          if (annotation) {
            annotations.push(annotation);
          }
        }
      }
      if (annotations.length > 0) return annotations;
    }
    return void 0;
  }
  function getInspectorSelectedId(element) {
    return element?.getAttribute("data-fginspector-selected") ?? void 0;
  }

  // src/lib/typography/probe.ts
  function fontStretchToKeyword(percentValue) {
    if (!percentValue.endsWith("%")) return percentValue.toLowerCase();
    const numeric = parseFloat(percentValue);
    if (isNaN(numeric)) return "normal";
    if (numeric <= 50) return "ultra-condensed";
    if (numeric <= 62.5) return "extra-condensed";
    if (numeric <= 75) return "condensed";
    if (numeric <= 87.5) return "semi-condensed";
    if (numeric <= 100) return "normal";
    if (numeric <= 112.5) return "semi-expanded";
    if (numeric <= 125) return "expanded";
    if (numeric <= 150) return "extra-expanded";
    return "ultra-expanded";
  }
  function parseFontFamily(fontFamilyString) {
    const families = [];
    const pattern = /(?:"([^"]+)"|'([^']+)'|([^,\s][^,]*))/g;
    let match;
    while ((match = pattern.exec(fontFamilyString)) !== null) {
      const familyName = (match[1] ?? match[2] ?? match[3])?.trim();
      if (familyName) {
        families.push(familyName);
      }
    }
    return families;
  }
  var TypefaceProbe = class {
    constructor() {
      this.families = /* @__PURE__ */ new Map();
      this.processedUsages = /* @__PURE__ */ new Set();
      this.unavailable = /* @__PURE__ */ new Set();
      this._canvas = null;
      this._ctx = null;
    }
    /**
     * Lazily create and return a 2D canvas rendering context for text measurement.
     */
    get ctx() {
      if (!this._ctx) {
        this._canvas = document.createElement("canvas");
        this._ctx = this._canvas.getContext("2d");
      }
      return this._ctx;
    }
    /**
     * Check whether a specific font variant is available in the current browser
     * by comparing rendered text width against generic fallback families.
     */
    checkFontAvailable(familyName, fontStretch, fontStyle, fontWeight) {
      if (!this.ctx) return false;
      const testString = "mmmmmmmmmmlli";
      const testSize = "72px";
      const stretchKeyword = fontStretchToKeyword(fontStretch);
      const fallbackFamilies = ["monospace", "sans-serif", "serif"];
      for (const fallback of fallbackFamilies) {
        this.ctx.font = `${stretchKeyword} ${fontStyle} ${fontWeight} ${testSize} ${fallback}`;
        const fallbackWidth = this.ctx.measureText(testString).width;
        this.ctx.font = `${stretchKeyword} ${fontStyle} ${fontWeight} ${testSize} "${familyName}", ${fallback}`;
        const candidateWidth = this.ctx.measureText(testString).width;
        if (fallbackWidth !== candidateWidth) return true;
      }
      return false;
    }
    /**
     * Register a font family and record its usage if the font is available.
     *
     * Parses the CSS `font-family` string, resolves the first available family,
     * and stores it along with the usage details.
     */
    addFontFamily(fontFamilyStr, fontStretch, fontStyle, fontWeight, fontSize) {
      const families = parseFontFamily(fontFamilyStr);
      for (const family of families) {
        const normalizedName = family.toLowerCase();
        const unavailableKey = `${normalizedName}|${fontStretch}|${fontStyle}|${fontWeight}`;
        if (this.unavailable.has(unavailableKey)) continue;
        if (this.families.has(normalizedName)) {
          this.addUsage(normalizedName, fontStretch, fontStyle, fontWeight, fontSize);
          return;
        }
        if (!this.checkFontAvailable(family, fontStretch, fontStyle, fontWeight)) {
          this.unavailable.add(unavailableKey);
          continue;
        }
        this.families.set(normalizedName, {
          familyName: family,
          faces: [],
          usages: []
        });
        this.addUsage(normalizedName, fontStretch, fontStyle, fontWeight, fontSize);
        return;
      }
    }
    /**
     * Record a specific font usage, deduplicating by a composite key.
     */
    addUsage(normalizedFamily, fontStretch, fontStyle, fontWeight, fontSize) {
      const usageKey = `${normalizedFamily}|${fontStretch}|${fontStyle}|${fontWeight}|${fontSize}`;
      if (this.processedUsages.has(usageKey)) return;
      this.processedUsages.add(usageKey);
      const familyEntry = this.families.get(normalizedFamily);
      if (familyEntry) {
        familyEntry.usages.push({
          fontWeight,
          fontStyle,
          fontStretch,
          fontSize
        });
      }
    }
    /**
     * Retrieve all collected fonts as a plain object.
     *
     * Calls `collectWebFontFaces()` before returning so that subclasses can
     * populate the `faces` arrays with @font-face data.
     */
    getFonts() {
      this.collectWebFontFaces();
      return Object.fromEntries(this.families);
    }
    /**
     * Hook for subclasses to populate web font face data.
     *
     * The base implementation is a no-op; subclasses override this to extract
     * @font-face descriptors from stylesheets.
     */
    collectWebFontFaces() {
    }
  };
  function resolveFonts(element, computedStyle, fontCollector) {
    const fontWeight = computedStyle.fontWeight ?? "400";
    const fontStyle = computedStyle.fontStyle === "italic" ? "italic" : "normal";
    const fontStretch = computedStyle.fontStretch ?? "100%";
    const fontSize = computedStyle.fontSize ?? "16px";
    const fontFamily = computedStyle.fontFamily ?? "Times";
    fontCollector.addFontFamily(fontFamily, fontStretch, fontStyle, fontWeight, fontSize);
  }

  // src/lib/media/svg.ts
  var SVG_STYLE_DEFAULTS = {
    alignmentBaseline: "baseline",
    clip: "auto",
    clipPath: "none",
    clipRule: "nonzero",
    color: "rgb(0, 0, 0)",
    colorInterpolation: "sRGB",
    colorRendering: "auto",
    cursor: "auto",
    direction: "ltr",
    display: "inline",
    dominantBaseline: "auto",
    fill: "rgb(0, 0, 0)",
    fillOpacity: "1",
    fillRule: "nonzero",
    filter: "none",
    floodColor: "rgb(0, 0, 0)",
    floodOpacity: "1",
    imageRendering: "auto",
    letterSpacing: "normal",
    lightingColor: "rgb(255, 255, 255)",
    lineHeight: "normal",
    markerEnd: "none",
    markerMid: "none",
    markerStart: "none",
    mask: "none",
    opacity: "1",
    overflow: "visible",
    paintOrder: "normal",
    shapeRendering: "auto",
    stopColor: "rgb(0, 0, 0)",
    stopOpacity: "1",
    stroke: "none",
    strokeDasharray: "none",
    strokeDashoffset: "0px",
    strokeLinecap: "butt",
    strokeLinejoin: "miter",
    strokeMiterlimit: "4",
    strokeOpacity: "1",
    strokeWidth: "1px",
    textAnchor: "start",
    textDecoration: "none solid rgb(0, 0, 0)",
    textRendering: "auto",
    unicodeBidi: "normal",
    vectorEffect: "none",
    visibility: "visible",
    whiteSpace: "normal",
    writingMode: "horizontal-tb"
  };
  function camelToKebabMap(keys) {
    return Object.fromEntries(
      keys.map((key) => [
        key,
        key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
      ])
    );
  }
  var kebabNames = camelToKebabMap(Object.keys(SVG_STYLE_DEFAULTS));
  function bakeSvgStyles(svgElement) {
    const clone = svgElement.cloneNode(true);
    copySvgComputedStyles(svgElement, clone);
    const { width, height } = window.getComputedStyle(svgElement);
    if (width.endsWith("px") && height.endsWith("px")) {
      clone.setAttribute("width", width);
      clone.setAttribute("height", height);
    }
    return clone.outerHTML;
  }
  function copySvgComputedStyles(source, target) {
    if (!(source instanceof Element) || !(target instanceof Element)) return;
    const computedStyle = window.getComputedStyle(source);
    for (const [property, defaultValue] of Object.entries(SVG_STYLE_DEFAULTS)) {
      const value = computedStyle.getPropertyValue(property);
      if (value && value.toLowerCase() !== defaultValue.toLowerCase()) {
        target.setAttribute(kebabNames[property], value);
      }
    }
    for (let i = 0; i < source.childNodes.length; i++) {
      copySvgComputedStyles(source.childNodes[i], target.childNodes[i]);
    }
  }

  // src/lib/transform/matrix.ts
  function hasRotation(matrix) {
    return Math.abs(matrix.b) > 1e-6 || Math.abs(matrix.c) > 1e-6;
  }
  function extractRotationMatrix(matrix) {
    if (matrix.is2D) {
      return new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, 0, 0]);
    }
    const result = DOMMatrix.fromMatrix(matrix);
    result.m41 = 0;
    result.m42 = 0;
    result.m43 = 0;
    return result;
  }
  function parseTransformOrigin(value) {
    const [tx, ty, tz] = value?.split(" ") ?? ["0px", "0px", "0px"];
    return new DOMPoint().matrixTransform(
      new DOMMatrix(`translate3d(${tx}, ${ty ?? "0px"}, ${tz ?? "0px"})`)
    );
  }
  function transformQuad(quad, matrix) {
    return new DOMQuad(
      quad.p1.matrixTransform(matrix),
      quad.p2.matrixTransform(matrix),
      quad.p3.matrixTransform(matrix),
      quad.p4.matrixTransform(matrix)
    );
  }
  function getRectCenter(rect) {
    return new DOMPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
  }
  function getElementDimensions(element) {
    let width = 0;
    let height = 0;
    if (element instanceof HTMLElement) {
      width = element.offsetWidth;
      height = element.offsetHeight;
    } else if (element instanceof SVGSVGElement) {
      const computed = getComputedStyle(element);
      width = parseFloat(computed.width) || element.width.baseVal.value;
      height = parseFloat(computed.height) || element.height.baseVal.value;
    } else if (element instanceof SVGGraphicsElement) {
      const bbox = element.getBBox();
      width = bbox.width;
      height = bbox.height;
    } else if (element instanceof MathMLElement) {
      const clientRect = element.getBoundingClientRect();
      width = clientRect.width;
      height = clientRect.height;
    } else if (element instanceof Text) {
      const range = document.createRange();
      range.selectNodeContents(element);
      const clientRect = range.getBoundingClientRect();
      width = clientRect.width;
      height = clientRect.height;
    }
    return { width, height };
  }
  function parseTranslate(value) {
    if (!value) return new DOMMatrix();
    const parts = value.trim().split(/\s+/);
    if (parts.length === 0) return new DOMMatrix();
    const x = parts[0];
    const y = parts[1] ?? "0px";
    const z = parts[2] ?? "0px";
    return new DOMMatrix(`translate3d(${x}, ${y}, ${z})`);
  }
  function parseScale(value) {
    if (!value) return new DOMMatrix();
    const parts = value.trim().split(/\s+/);
    if (parts.length === 0) return new DOMMatrix();
    if (parts.length > 3) throw new Error(`Invalid scale value: ${value}`);
    const x = parts[0];
    const y = parts[1] ?? parts[0];
    const z = parts[2] ?? 1;
    return new DOMMatrix(`scale3d(${x}, ${y}, ${z})`);
  }
  function parseRotate(value) {
    if (!value) return new DOMMatrix();
    const parts = value.trim().split(/\s+/);
    if (parts.length === 0) return new DOMMatrix();
    if (parts.length === 1) {
      return new DOMMatrix(`rotate(${parts[0]})`);
    }
    if (parts.length === 2) {
      switch (parts[0]) {
        case "x":
          return new DOMMatrix(`rotateX(${parts[1]})`);
        case "y":
          return new DOMMatrix(`rotateY(${parts[1]})`);
        case "z":
          return new DOMMatrix(`rotateZ(${parts[1]})`);
        default:
          return new DOMMatrix();
      }
    }
    if (parts.length === 4) {
      return new DOMMatrix(
        `rotate3d(${parts[0]}, ${parts[1]}, ${parts[2]}, ${parts[3]})`
      );
    }
    return new DOMMatrix();
  }
  function resolveTransform(computedStyle) {
    if (!computedStyle.rotate && !computedStyle.scale && !computedStyle.transform && !computedStyle.translate) {
      return null;
    }
    try {
      const [ox, oy, oz] = computedStyle.transformOrigin?.split(" ") ?? ["0px", "0px", "0px"];
      const originMatrix = new DOMMatrix(
        `translate3d(${ox}, ${oy ?? "0px"}, ${oz ?? "0px"})`
      );
      return originMatrix.multiply(parseTranslate(computedStyle.translate)).multiply(parseRotate(computedStyle.rotate)).multiply(parseScale(computedStyle.scale)).multiply(new DOMMatrix(computedStyle.transform ?? "none")).multiply(originMatrix.inverse());
    } catch (_error) {
      return null;
    }
  }
  function multiplyMatrices(a, b) {
    if (!a && !b) return void 0;
    if (a) return b ? a.multiply(b) : a;
    return b ?? void 0;
  }
  function getElementRect(element, computedStyle, combinedTransform) {
    const boundingRect = element instanceof Element ? element.getBoundingClientRect() : (() => {
      const r = document.createRange();
      r.selectNode(element);
      const rect = r.getBoundingClientRect();
      r.detach();
      return rect;
    })();
    let { x, y, width, height } = boundingRect;
    const dimensions = getElementDimensions(element);
    let cssWidth = dimensions.width;
    let cssHeight = dimensions.height;
    if (element instanceof HTMLElement) {
      const tag = element.tagName;
      if (tag === "HTML" || tag === "BODY") {
        const explicitWidth = element.style.getPropertyValue("max-width");
        const explicitPx = explicitWidth ? parseInt(explicitWidth, 10) : 0;
        if (explicitPx > 0) {
          width = explicitPx;
          cssWidth = explicitPx;
        } else {
          const fullWidth = Math.max(element.scrollWidth, width);
          width = fullWidth;
          cssWidth = fullWidth;
        }
        const fullHeight = Math.max(element.scrollHeight, height);
        height = fullHeight;
        cssHeight = fullHeight;
      }
    }
    if (!combinedTransform || !hasRotation(combinedTransform)) {
      return { x, y, width, height, cssWidth, cssHeight };
    }
    try {
      const quad = computeRotatedQuad(element, computedStyle, combinedTransform);
      return { x, y, width, height, cssWidth, cssHeight, quad };
    } catch (_error) {
      return { x, y, width, height, cssWidth, cssHeight };
    }
  }
  function computeRotatedQuad(element, computedStyle, combinedTransform) {
    const boundingRect = element instanceof Element ? element.getBoundingClientRect() : (() => {
      const r = document.createRange();
      r.selectNode(element);
      const rect = r.getBoundingClientRect();
      r.detach();
      return rect;
    })();
    const dimensions = getElementDimensions(element);
    const elementWidth = dimensions.width;
    const elementHeight = dimensions.height;
    const origin = parseTransformOrigin(computedStyle.transformOrigin);
    const localQuad = DOMQuad.fromQuad({
      p1: { x: -origin.x, y: -origin.y },
      p2: { x: elementWidth - origin.x, y: -origin.y },
      p3: { x: elementWidth - origin.x, y: elementHeight - origin.y },
      p4: { x: -origin.x, y: elementHeight - origin.y }
    });
    const rectCenter = getRectCenter(boundingRect);
    const originOffset = new DOMPoint(
      origin.x - elementWidth / 2,
      origin.y - elementHeight / 2
    );
    const rotationOnly = extractRotationMatrix(combinedTransform);
    const transformedOffset = originOffset.matrixTransform(rotationOnly);
    const rotatedQuad = transformQuad(localQuad, rotationOnly);
    const translationMatrix = new DOMMatrix().translate(
      rectCenter.x + transformedOffset.x,
      rectCenter.y + transformedOffset.y
    );
    const finalQuad = transformQuad(rotatedQuad, translationMatrix);
    return {
      p1: { x: finalQuad.p1.x, y: finalQuad.p1.y },
      p2: { x: finalQuad.p2.x, y: finalQuad.p2.y },
      p3: { x: finalQuad.p3.x, y: finalQuad.p3.y },
      p4: { x: finalQuad.p4.x, y: finalQuad.p4.y }
    };
  }

  // src/lib/react/tree.ts
  var MAX_PROP_LENGTH = 100;
  var FIBER_TAGS = Object.freeze({
    FunctionComponent: 0,
    ClassComponent: 1,
    HostRoot: 3,
    HostPortal: 4,
    HostComponent: 5,
    HostText: 6,
    Fragment: 7,
    Mode: 8,
    ContextConsumer: 9,
    ContextProvider: 10,
    ForwardRef: 11,
    Profiler: 12,
    SuspenseComponent: 13,
    MemoComponent: 14,
    SimpleMemoComponent: 15,
    LazyComponent: 16,
    IncompleteClassComponent: 17,
    DehydratedFragment: 18,
    SuspenseListComponent: 19,
    ScopeComponent: 21,
    OffscreenComponent: 22,
    LegacyHiddenComponent: 23,
    CacheComponent: 24,
    TracingMarkerComponent: 25,
    HostHoistable: 26,
    HostSingleton: 27,
    IncompleteFunctionComponent: 28,
    Throw: 29,
    ViewTransitionComponent: 30,
    ActivityComponent: 31
  });
  var propRefMap = /* @__PURE__ */ new WeakMap();
  var propRefCounter = 0;
  var COMPONENT_FIBER_TAGS = /* @__PURE__ */ new Set([0, 1, 11, 14, 15]);
  function extractComponentTree(element, getNodeId2) {
    propRefCounter = 0;
    const rootFiber = findRootFiber(element);
    return rootFiber ? captureFiberNode(rootFiber, getNodeId2) : null;
  }
  function findParentComponent(element) {
    const fiber = getReactFiber(element);
    if (fiber == null) return void 0;
    if (fiber._debugOwner) {
      let current = fiber;
      while (current._debugOwner && current._debugOwner.memoizedProps?._fgT != null) {
        current = current._debugOwner;
      }
      return current._debugOwner ? getFiberDisplayName(current._debugOwner) : void 0;
    }
    return findWrappingComponent(fiber) ?? void 0;
  }
  function findRootFiber(element) {
    const fiber = getReactFiber(element);
    if (fiber) return fiber;
    if (element instanceof Element) {
      for (const child of element.children) {
        const childFiber = getReactFiber(child);
        if (childFiber) return childFiber;
      }
      for (const child of element.children) {
        const found = findRootFiber(child);
        if (found) return found;
      }
    }
    return void 0;
  }
  function captureFiberNode(fiber, getNodeId2) {
    const fiberTag = fiber.tag ?? null;
    const name = getFiberDisplayName(fiber);
    let h2dId;
    if (fiber.stateNode instanceof Node) {
      h2dId = getNodeId2(fiber.stateNode);
    }
    const props = fiber.memoizedProps ? serializeProps(fiber.memoizedProps) : void 0;
    const children = [];
    let child = fiber.child;
    while (child) {
      const serialized = captureFiberNode(child, getNodeId2);
      if (serialized) {
        children.push(serialized);
      }
      child = child.sibling;
    }
    return { h2dId, name, fiberTag, props, children };
  }
  function serializeProps(props) {
    const result = {};
    for (const [key, value] of Object.entries(props)) {
      result[key] = formatPropValue(value);
    }
    return result;
  }
  function formatPropValue(value) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null || value === void 0) {
      if (typeof value === "string" && value.length > MAX_PROP_LENGTH) {
        return {
          truncated: true,
          value: value.slice(0, MAX_PROP_LENGTH),
          originalLength: value.length
        };
      }
      return value;
    }
    if (typeof value === "object" || typeof value === "function") {
      const target = value;
      let ref = propRefMap.get(target);
      if (!ref) {
        ref = `prop-ref-${++propRefCounter}`;
        propRefMap.set(target, ref);
      }
      return { ref };
    }
    return void 0;
  }
  function getFiberDisplayName(fiber) {
    if (typeof fiber.type === "string") {
      return fiber.type;
    }
    if (typeof fiber.type === "function") {
      const fn = fiber.type;
      return fn.displayName ?? fn.name;
    }
    if (typeof fiber.type === "object" && fiber.type !== null) {
      const wrappedType = fiber.type;
      return wrappedType.displayName ?? wrappedType.name;
    }
    return void 0;
  }
  function findWrappingComponent(fiber) {
    let parent = fiber.return;
    let previous = fiber;
    let candidate = null;
    while (parent) {
      if (parent.tag === FIBER_TAGS.HostComponent || parent.child !== previous || previous.sibling != null) {
        return candidate;
      }
      if (COMPONENT_FIBER_TAGS.has(parent.tag ?? -1)) {
        const name = getFiberDisplayName(parent);
        if (name && /^.{5,}$/.test(name) && !/^Primitive\./i.test(name) && !/^Styled\./i.test(name) && !/Provider$/i.test(name) && name !== "__next_metadata_boundary__" && !/^[a-zA-Z]+\(.*\)$/.test(name)) {
          candidate = name;
        }
      }
      previous = parent;
      parent = parent.return;
    }
    return candidate;
  }

  // src/lib/core/layout.ts
  function inferLayoutSizing(element, styles, parentElement) {
    if (!parentElement) {
      return { horizontal: "HUG", vertical: "HUG" };
    }
    const parentComputed = window.getComputedStyle(parentElement);
    const parentDisplay = parentComputed.display;
    const isFlexChild = parentDisplay === "flex" || parentDisplay === "inline-flex";
    const isGridChild = parentDisplay === "grid" || parentDisplay === "inline-grid";
    if (!isFlexChild && !isGridChild) {
      return inferBlockLayoutSizing(element, styles, parentElement);
    }
    const computed = window.getComputedStyle(element);
    const styleMap = "computedStyleMap" in element ? element.computedStyleMap() : null;
    const parentDirection = parentComputed.flexDirection || "row";
    const isRow = parentDirection === "row" || parentDirection === "row-reverse";
    const flexGrow = parseFloat(styles.flexGrow || computed.flexGrow || "0");
    const alignSelf = styles.alignSelf || computed.alignSelf || "auto";
    const parentAlignItems = parentComputed.alignItems || "normal";
    const effectiveAlign = alignSelf !== "auto" ? alignSelf : parentAlignItems;
    const isStretch = effectiveAlign === "stretch" || effectiveAlign === "normal";
    const widthRaw = styleMap?.get("width")?.toString() || "";
    const heightRaw = styleMap?.get("height")?.toString() || "";
    const parentRect = parentElement.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const maxWidth = computed.maxWidth;
    const maxHeight = computed.maxHeight;
    const marginLeftRaw = styleMap?.get("margin-left")?.toString() || computed.marginLeft;
    const marginRightRaw = styleMap?.get("margin-right")?.toString() || computed.marginRight;
    const marginTopRaw = styleMap?.get("margin-top")?.toString() || computed.marginTop;
    const marginBottomRaw = styleMap?.get("margin-bottom")?.toString() || computed.marginBottom;
    let mainSizing;
    if (flexGrow > 0) {
      mainSizing = "FILL";
    } else if (isRow && widthRaw.endsWith("%")) {
      mainSizing = "FILL";
    } else if (!isRow && heightRaw.endsWith("%")) {
      mainSizing = "FILL";
    } else if (isRow && isAdaptiveWrapper(elementRect.width, parentRect.width, maxWidth, marginLeftRaw, marginRightRaw)) {
      mainSizing = "FILL";
    } else if (!isRow && isAdaptiveWrapper(elementRect.height, parentRect.height, maxHeight, marginTopRaw, marginBottomRaw)) {
      mainSizing = "FILL";
    } else if (isRow && widthRaw === "auto") {
      mainSizing = "HUG";
    } else if (!isRow && heightRaw === "auto") {
      mainSizing = "HUG";
    } else if (isRow && widthRaw && widthRaw !== "auto") {
      mainSizing = "FIXED";
    } else if (!isRow && heightRaw && heightRaw !== "auto") {
      mainSizing = "FIXED";
    } else {
      mainSizing = "HUG";
    }
    let crossSizing;
    if (isStretch) {
      const crossRaw = isRow ? heightRaw : widthRaw;
      const crossElementSize = isRow ? elementRect.height : elementRect.width;
      const crossParentSize = isRow ? parentRect.height : parentRect.width;
      const crossMaxSize = isRow ? maxHeight : maxWidth;
      const crossMarginStart = isRow ? marginTopRaw : marginLeftRaw;
      const crossMarginEnd = isRow ? marginBottomRaw : marginRightRaw;
      if (!crossRaw || crossRaw === "auto" || crossRaw.endsWith("%")) {
        crossSizing = "FILL";
      } else if (isAdaptiveWrapper(crossElementSize, crossParentSize, crossMaxSize, crossMarginStart, crossMarginEnd)) {
        crossSizing = "FILL";
      } else {
        crossSizing = "FIXED";
      }
    } else {
      const crossRaw = isRow ? heightRaw : widthRaw;
      const crossMaxSize = isRow ? maxHeight : maxWidth;
      const crossMarginStart = isRow ? marginTopRaw : marginLeftRaw;
      const crossMarginEnd = isRow ? marginBottomRaw : marginRightRaw;
      const crossElementSize = isRow ? elementRect.height : elementRect.width;
      const crossParentSize = isRow ? parentRect.height : parentRect.width;
      if (crossRaw && crossRaw.endsWith("%")) {
        crossSizing = "FILL";
      } else if (isAdaptiveWrapper(crossElementSize, crossParentSize, crossMaxSize, crossMarginStart, crossMarginEnd)) {
        crossSizing = "FILL";
      } else if (crossRaw && crossRaw !== "auto") {
        crossSizing = "FIXED";
      } else {
        crossSizing = "HUG";
      }
    }
    if (isRow) {
      return { horizontal: mainSizing, vertical: crossSizing };
    } else {
      return { horizontal: crossSizing, vertical: mainSizing };
    }
  }
  function isAdaptiveWrapper(elementSize, parentSize, maxSize, marginStart, marginEnd) {
    if (parentSize <= 0) return false;
    const ratio = elementSize / parentSize;
    const isCentered = marginStart === "auto" || marginEnd === "auto";
    const hasMaxConstraint = maxSize && maxSize !== "none" && maxSize !== "0px";
    if (isCentered) return true;
    if (hasMaxConstraint && ratio >= 0.9) return true;
    if (ratio >= 0.95 && parentSize >= 200) return true;
    return false;
  }
  function inferBlockLayoutSizing(element, styles, parentElement) {
    const computed = window.getComputedStyle(element);
    const styleMap = "computedStyleMap" in element ? element.computedStyleMap() : null;
    const widthRaw = styleMap?.get("width")?.toString() || "";
    const marginLeftRaw = styleMap?.get("margin-left")?.toString() || computed.marginLeft;
    const marginRightRaw = styleMap?.get("margin-right")?.toString() || computed.marginRight;
    const maxWidth = computed.maxWidth;
    const display = computed.display;
    const parentRect = parentElement.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    let horizontal;
    if (display === "block" || display === "list-item" || display === "table") {
      if (widthRaw === "auto" || !widthRaw) {
        horizontal = "FILL";
      } else if (widthRaw.endsWith("%")) {
        horizontal = "FILL";
      } else if (isAdaptiveWrapper(elementRect.width, parentRect.width, maxWidth, marginLeftRaw, marginRightRaw)) {
        horizontal = "FILL";
      } else {
        horizontal = "FIXED";
      }
    } else {
      horizontal = "HUG";
    }
    return { horizontal, vertical: "HUG" };
  }

  // src/lib/core/walker.ts
  var NODE_TYPES = {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3
  };
  var ALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set([
    "alt",
    "checked",
    "currentSrc",
    "disabled",
    "for",
    "href",
    "id",
    "multiple",
    "placeholder",
    "poster",
    "readonly",
    "rel",
    "required",
    "role",
    "selected",
    "target",
    "title",
    "type",
    "value"
  ]);
  var INPUT_TYPES_WITH_PLACEHOLDER = /* @__PURE__ */ new Set([
    "text",
    "search",
    "tel",
    "url",
    "email",
    "password",
    "number"
  ]);
  var OFFSCREEN_MARGIN = 500;
  function isNodeVisible(element) {
    if (element instanceof HTMLScriptElement) return false;
    if (element.nodeType === Node.ELEMENT_NODE && (element.getAttribute("data-h2d-ignore") === "true" || element.getAttribute("data-web2fig-ignore") === "true")) {
      return false;
    }
    const computed = window.getComputedStyle(element);
    if (computed.display === "none") return false;
    if (computed.visibility === "hidden") return false;
    return true;
  }
  function shouldPruneNode(element, rect, childNodes) {
    const hasVisibleChildren = childNodes.length > 0;
    const tag = element.tagName.toUpperCase();
    if (rect.width === 0 && rect.height === 0 && !hasVisibleChildren) {
      return true;
    }
    if (rect.width === 0 && rect.height === 0 && hasVisibleChildren) {
      if (tag === "HTML" || tag === "BODY") return false;
      const hasNonZeroChild = childNodes.some((child) => {
        if (child.nodeType === NODE_TYPES.ELEMENT_NODE) {
          const el = child;
          return el.rect.width > 0 || el.rect.height > 0;
        }
        if (child.nodeType === NODE_TYPES.TEXT_NODE) {
          const text = child;
          return text.rect.width > 0 || text.rect.height > 0;
        }
        return false;
      });
      if (!hasNonZeroChild) return true;
    }
    const docW = Math.max(
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
      window.innerWidth
    );
    const docH = Math.max(
      document.documentElement.scrollHeight,
      document.documentElement.clientHeight,
      window.innerHeight
    );
    if (rect.width > 0 && rect.height > 0 && (rect.x + rect.width < -OFFSCREEN_MARGIN || rect.x > docW + OFFSCREEN_MARGIN || rect.y + rect.height < -OFFSCREEN_MARGIN || rect.y > docH + OFFSCREEN_MARGIN)) {
      if (tag !== "HTML" && tag !== "BODY") {
        return true;
      }
    }
    return false;
  }
  function getTextRect(nodeOrNodes) {
    const range = document.createRange();
    if (Array.isArray(nodeOrNodes)) {
      const first = nodeOrNodes[0];
      const last = nodeOrNodes[nodeOrNodes.length - 1];
      range.setStart(first, 0);
      range.setEnd(last, last.length);
    } else {
      range.selectNode(nodeOrNodes);
    }
    const { x, y, width, height } = range.getBoundingClientRect();
    const isVertical = range.commonAncestorContainer instanceof HTMLElement ? window.getComputedStyle(range.commonAncestorContainer).writingMode.startsWith("vertical") : false;
    const clientRects = Array.from(range.getClientRects()).filter(
      (rect) => rect.width > 0 && rect.height > 0
    );
    const lineCount = isVertical ? new Set(clientRects.map((rect) => Math.round(rect.left))).size : new Set(clientRects.map((rect) => Math.round(rect.top))).size;
    range.detach();
    return { x, y, width, height, lineCount };
  }
  function getElementAttributes(element) {
    const attrs = {};
    for (const { name, value } of element.attributes) {
      const lowerName = name.toLowerCase();
      if (ALLOWED_ATTRIBUTES.has(lowerName) || lowerName.startsWith("aria-") || lowerName.startsWith("data-")) {
        attrs[name] = value;
      }
    }
    if (element instanceof HTMLVideoElement && element.poster) {
      attrs.poster = element.poster;
    }
    if ((element instanceof HTMLImageElement || element instanceof HTMLVideoElement) && element.currentSrc) {
      attrs.currentSrc = element.currentSrc;
    }
    if (element instanceof HTMLImageElement && element.src) {
      attrs.src = element.src;
    }
    if (element instanceof HTMLInputElement) {
      if (attrs.type == null) attrs.type = element.type;
      if (element.type !== "password") attrs.value = element.value;
      if (element.type === "checkbox" || element.type === "radio") {
        attrs.checked = element.checked ? "true" : "false";
      }
    } else if (element instanceof HTMLTextAreaElement) {
      attrs.value = element.value;
    } else if (element instanceof HTMLSelectElement) {
      attrs.value = element.value;
    } else if (element instanceof HTMLDetailsElement) {
      attrs.open = element.open ? "true" : "false";
    }
    return attrs;
  }
  function matrixToSimple(matrix) {
    return {
      a: matrix.a,
      b: matrix.b,
      c: matrix.c,
      d: matrix.d,
      e: matrix.e,
      f: matrix.f
    };
  }
  function* iterateChildNodes(parent) {
    for (let i = 0; i < parent.childNodes.length; i++) {
      const child = parent.childNodes[i];
      if (child.nodeType === Node.TEXT_NODE) {
        const textGroup = [child];
        let nextIndex = i + 1;
        while (nextIndex < parent.childNodes.length && parent.childNodes[nextIndex].nodeType === Node.TEXT_NODE) {
          textGroup.push(parent.childNodes[nextIndex]);
          nextIndex += 1;
        }
        yield textGroup;
        i = nextIndex - 1;
      } else {
        yield child;
      }
    }
  }

  // src/lib/core/css-defaults.ts
  var BASELINE_STYLES = {
    alignContent: "normal",
    alignItems: "normal",
    alignSelf: "auto",
    aspectRatio: "auto",
    backdropFilter: "none",
    backgroundAttachment: "scroll",
    backgroundBlendMode: "normal",
    backgroundClip: "border-box",
    backgroundColor: "rgba(0, 0, 0, 0)",
    backgroundImage: "none",
    backgroundOrigin: "padding-box",
    backgroundPositionX: "0%",
    backgroundPositionY: "0%",
    backgroundRepeat: "repeat",
    backgroundSize: "auto",
    borderBottomColor: "rgb(0, 0, 0)",
    borderBottomLeftRadius: "0px",
    borderBottomRightRadius: "0px",
    borderBottomStyle: "none",
    borderBottomWidth: "0px",
    borderCollapse: "separate",
    borderImageOutset: "0",
    borderImageRepeat: "stretch",
    borderImageSlice: "100%",
    borderImageSource: "none",
    borderImageWidth: "1",
    borderLeftColor: "rgb(0, 0, 0)",
    borderLeftStyle: "none",
    borderLeftWidth: "0px",
    borderRightColor: "rgb(0, 0, 0)",
    borderRightStyle: "none",
    borderRightWidth: "0px",
    borderSpacing: "0px",
    borderTopColor: "rgb(0, 0, 0)",
    borderTopLeftRadius: "0px",
    borderTopRightRadius: "0px",
    borderTopStyle: "none",
    borderTopWidth: "0px",
    bottom: "auto",
    boxShadow: "none",
    boxSizing: "content-box",
    clip: "auto",
    clipPath: "none",
    clipRule: "nonzero",
    color: "rgb(0, 0, 0)",
    colorScheme: "normal",
    columnCount: "auto",
    columnFill: "balance",
    columnGap: "normal",
    columnRuleColor: "rgb(0, 0, 0)",
    columnRuleStyle: "none",
    columnRuleWidth: "0px",
    columnSpan: "none",
    columnWidth: "auto",
    contain: "none",
    containerType: "normal",
    content: "normal",
    contentVisibility: "visible",
    display: "",
    filter: "none",
    flexBasis: "auto",
    flexDirection: "row",
    flexGrow: "0",
    flexShrink: "1",
    flexWrap: "nowrap",
    fontFamily: "Times",
    fontFeatureSettings: "normal",
    fontKerning: "auto",
    fontOpticalSizing: "auto",
    fontPalette: "normal",
    fontSynthesis: "weight style small-caps position",
    fontSize: "16px",
    fontSizeAdjust: "none",
    fontStretch: "100%",
    fontStyle: "normal",
    fontVariantCaps: "normal",
    fontVariationSettings: "normal",
    fontWeight: "400",
    gridAutoColumns: "auto",
    gridAutoFlow: "row",
    gridAutoRows: "auto",
    gridColumnEnd: "auto",
    gridColumnStart: "auto",
    gridRowEnd: "auto",
    gridRowStart: "auto",
    gridTemplateAreas: "none",
    gridTemplateColumns: "none",
    gridTemplateRows: "none",
    height: "auto",
    isolation: "auto",
    justifyItems: "normal",
    justifySelf: "auto",
    justifyContent: "normal",
    left: "auto",
    letterSpacing: "normal",
    lineBreak: "auto",
    lineHeight: "normal",
    listStyleImage: "none",
    listStylePosition: "outside",
    listStyleType: "disc",
    marginBottom: "0px",
    marginLeft: "0px",
    marginRight: "0px",
    marginTop: "0px",
    maxHeight: "none",
    maxWidth: "none",
    maskClip: "border-box",
    maskImage: "none",
    maskOrigin: "border-box",
    maskPositionX: "0%",
    maskPositionY: "0%",
    maskRepeat: "repeat",
    maskSize: "auto",
    minHeight: "0px",
    minWidth: "0px",
    mixBlendMode: "normal",
    objectFit: "fill",
    opacity: "1",
    order: "0",
    outlineColor: "rgb(0, 0, 0)",
    outlineOffset: "0px",
    outlineStyle: "none",
    outlineWidth: "0px",
    objectPosition: "50% 50%",
    overflow: "visible",
    overflowX: "visible",
    overflowY: "visible",
    position: "static",
    paddingBottom: "0px",
    paddingLeft: "0px",
    paddingRight: "0px",
    paddingTop: "0px",
    right: "auto",
    rowGap: "normal",
    strokeDasharray: "none",
    strokeDashoffset: "0px",
    strokeLinecap: "butt",
    strokeLinejoin: "miter",
    strokeMiterlimit: "4",
    strokeOpacity: "1",
    strokeWidth: "1px",
    textAlign: "start",
    textDecorationColor: "rgb(0, 0, 0)",
    textDecorationLine: "none",
    textDecorationStyle: "solid",
    textDecorationThickness: "auto",
    textIndent: "0px",
    textOverflow: "clip",
    textUnderlineOffset: "auto",
    textShadow: "none",
    textTransform: "none",
    top: "auto",
    transform: "none",
    transformOrigin: "auto",
    translate: "none",
    transitionProperty: "all",
    verticalAlign: "baseline",
    visibility: "visible",
    whiteSpace: "normal",
    wordBreak: "normal",
    overflowWrap: "normal",
    hyphens: "manual",
    width: "auto",
    willChange: "auto",
    writingMode: "horizontal-tb",
    webkitMaskImage: "none",
    zoom: "1",
    zIndex: "auto",
    rotate: "none",
    scale: "none"
  };

  // src/lib/core/styles.ts
  var BORDER_GROUPS = [
    { style: "borderTopStyle", width: "borderTopWidth", color: "borderTopColor" },
    { style: "borderRightStyle", width: "borderRightWidth", color: "borderRightColor" },
    { style: "borderBottomStyle", width: "borderBottomWidth", color: "borderBottomColor" },
    { style: "borderLeftStyle", width: "borderLeftWidth", color: "borderLeftColor" }
  ];
  function diffStyles(element, pseudo) {
    const diff = {};
    const computed = window.getComputedStyle(element, pseudo);
    const styleMap = "computedStyleMap" in element && !pseudo ? element.computedStyleMap() : null;
    for (const [property, defaultValue] of Object.entries(BASELINE_STYLES)) {
      const value = computed.getPropertyValue(property) || computed[property];
      if (value !== defaultValue) {
        diff[property] = value;
      }
    }
    for (const dimension of ["width", "height"]) {
      const mapped = styleMap?.get(dimension)?.toString();
      if (mapped && mapped === BASELINE_STYLES[dimension]) {
        delete diff[dimension];
      }
    }
    for (const group of BORDER_GROUPS) {
      if (diff[group.width] == null) {
        delete diff[group.style];
        delete diff[group.color];
      }
    }
    if (diff.outlineWidth == null) {
      delete diff.outlineStyle;
      delete diff.outlineColor;
    }
    return diff;
  }
  var FLEX_CONTAINER_PROPS = [
    "flexDirection",
    "flexWrap",
    "justifyContent",
    "alignItems",
    "alignContent",
    "columnGap",
    "rowGap"
  ];
  var FLEX_ITEM_PROPS = [
    "flexGrow",
    "flexShrink",
    "flexBasis",
    "alignSelf",
    "order"
  ];
  var GRID_CONTAINER_PROPS = [
    "gridTemplateColumns",
    "gridTemplateRows",
    "gridAutoFlow",
    "gridAutoColumns",
    "gridAutoRows",
    "gridTemplateAreas",
    "columnGap",
    "rowGap"
  ];
  function ensureFlexProps(element, styles) {
    const computed = window.getComputedStyle(element);
    for (const prop of FLEX_CONTAINER_PROPS) {
      if (!(prop in styles)) {
        styles[prop] = computed.getPropertyValue(
          prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
        ) || BASELINE_STYLES[prop] || "";
      }
    }
  }
  function ensureGridProps(element, styles) {
    const computed = window.getComputedStyle(element);
    for (const prop of GRID_CONTAINER_PROPS) {
      if (!(prop in styles)) {
        styles[prop] = computed.getPropertyValue(
          prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
        ) || BASELINE_STYLES[prop] || "";
      }
    }
  }
  function ensureFlexItemProps(element, styles) {
    const computed = window.getComputedStyle(element);
    for (const prop of FLEX_ITEM_PROPS) {
      if (!(prop in styles)) {
        styles[prop] = computed.getPropertyValue(
          prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
        ) || BASELINE_STYLES[prop] || "";
      }
    }
  }

  // src/lib/core/prepare.ts
  function assertLayoutValid(options) {
    if (!options.assertLayoutValid) return;
    const rect = document.body.getBoundingClientRect();
    if (rect.x === 0 && rect.y === 0 && rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.right === 0 && rect.bottom === 0 && rect.left === 0) {
      throw new Error("Document does not have valid layout");
    }
  }
  function decodeImages(images) {
    return Promise.allSettled(
      images.filter((img) => img.src && img.src !== "").map(
        (img) => withTimeout(img.decode(), IMAGE_DECODE_TIMEOUT, `Timed out while decoding image: ${img.currentSrc || img.src}`).catch((err) => {
          console.debug("Error decoding image", err, img.src);
        })
      )
    ).then(() => void 0);
  }
  var restoreCaptureState = null;
  function resetCaptureState() {
    restoreCaptureState = null;
  }
  function cleanupCaptureState() {
    if (restoreCaptureState !== null) {
      restoreCaptureState();
      restoreCaptureState = null;
    }
  }
  function waitForAnimationFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  async function waitForStableRender() {
    // Mutating lazy-image attributes, visiting every scroll position, and
    // hiding scrollbars all change responsive layouts. Wait for the browser to
    // settle without changing the user-visible rendering instead.
    await Promise.race([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 1500))
    ]).catch(() => void 0);
    await waitForAnimationFrame();
    await waitForAnimationFrame();
  }
  function captureScrollState(container) {
    const isRoot = container === document.documentElement || container === document.body;
    if (isRoot) {
      const x = window.scrollX;
      const y = window.scrollY;
      const scrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      return () => {
        document.documentElement.style.scrollBehavior = scrollBehavior;
        window.scrollTo(x, y);
      };
    }
    // A selected component may itself be a scroll container. Preserve its
    // visible state rather than resetting it and capturing different content.
    return () => {
    };
  }
  async function prepareForCapture(container) {
    restoreCaptureState = captureScrollState(container);
    await waitForStableRender();
  }

  // src/lib/core/declared.ts
  var FLEX_STYLE_KEYS = [
    { jsKey: "display", cssKey: "display" },
    { jsKey: "flexDirection", cssKey: "flex-direction" },
    { jsKey: "flexWrap", cssKey: "flex-wrap" },
    { jsKey: "justifyContent", cssKey: "justify-content" },
    { jsKey: "alignItems", cssKey: "align-items" },
    { jsKey: "alignContent", cssKey: "align-content" },
    { jsKey: "columnGap", cssKey: "column-gap" },
    { jsKey: "rowGap", cssKey: "row-gap" },
    { jsKey: "gap", cssKey: "gap" },
    { jsKey: "flexGrow", cssKey: "flex-grow" },
    { jsKey: "flexShrink", cssKey: "flex-shrink" },
    { jsKey: "flexBasis", cssKey: "flex-basis" },
    { jsKey: "alignSelf", cssKey: "align-self" },
    { jsKey: "order", cssKey: "order" },
    { jsKey: "flex", cssKey: "flex" }
  ];
  var GRID_STYLE_KEYS = [
    { jsKey: "display", cssKey: "display" },
    { jsKey: "gridTemplateColumns", cssKey: "grid-template-columns" },
    { jsKey: "gridTemplateRows", cssKey: "grid-template-rows" },
    { jsKey: "gridColumnStart", cssKey: "grid-column-start" },
    { jsKey: "gridColumnEnd", cssKey: "grid-column-end" },
    { jsKey: "gridRowStart", cssKey: "grid-row-start" },
    { jsKey: "gridRowEnd", cssKey: "grid-row-end" },
    { jsKey: "columnGap", cssKey: "column-gap" },
    { jsKey: "rowGap", cssKey: "row-gap" },
    { jsKey: "gap", cssKey: "gap" },
    { jsKey: "gridAutoFlow", cssKey: "grid-auto-flow" },
    { jsKey: "gridTemplateAreas", cssKey: "grid-template-areas" },
    { jsKey: "gridAutoColumns", cssKey: "grid-auto-columns" },
    { jsKey: "gridAutoRows", cssKey: "grid-auto-rows" },
    { jsKey: "gridColumn", cssKey: "grid-column" },
    { jsKey: "gridRow", cssKey: "grid-row" }
  ];
  var CSS_MEDIA_RULE = 4;
  var CSS_SUPPORTS_RULE = 12;
  var LAYOUT_STYLE_KEYS = [...FLEX_STYLE_KEYS, ...GRID_STYLE_KEYS];
  function hasLayoutStyles(style) {
    for (const { cssKey } of LAYOUT_STYLE_KEYS) {
      if (style.getPropertyValue(cssKey).trim()) return true;
    }
    return false;
  }
  function collectLayoutRules(ruleList) {
    const entries = [];
    for (let i = 0; i < ruleList.length; i++) {
      const rule = ruleList[i];
      if (rule == null) continue;
      if (rule.type === CSSRule.STYLE_RULE) {
        const styleRule = rule;
        if (hasLayoutStyles(styleRule.style)) {
          entries.push({ type: "style", rule: styleRule });
        }
        continue;
      }
      if (rule.type === CSS_MEDIA_RULE) {
        const mediaRule = rule;
        const innerEntries = collectLayoutRules(mediaRule.cssRules);
        if (innerEntries.length > 0) {
          entries.push({
            type: "media",
            mediaText: mediaRule.media.mediaText,
            inner: innerEntries
          });
        }
        continue;
      }
      if (rule.type === CSS_SUPPORTS_RULE) {
        const supportsRule = rule;
        try {
          const cssApi = globalThis.CSS;
          if (cssApi?.supports(supportsRule.conditionText)) {
            entries.push(...collectLayoutRules(supportsRule.cssRules));
          }
        } catch (_ignored) {
        }
        continue;
      }
      if ("cssRules" in rule && rule.cssRules) {
        entries.push(...collectLayoutRules(rule.cssRules));
      }
    }
    return entries;
  }
  function buildStylesheetCache(doc) {
    const entries = [];
    for (let i = 0; i < doc.styleSheets.length; i++) {
      const sheet = doc.styleSheets[i];
      if (sheet == null) continue;
      let rules;
      try {
        rules = sheet.cssRules ?? sheet.rules;
      } catch (_ignored) {
        continue;
      }
      if (rules) entries.push(...collectLayoutRules(rules));
    }
    return { entries, matchMediaCache: /* @__PURE__ */ new Map() };
  }
  function matchLayoutRules(element, cache, defaultView) {
    const result = {};
    const { entries, matchMediaCache } = cache;
    function processEntries(items) {
      for (const entry of items) {
        if (entry.type === "media") {
          let matches = matchMediaCache.get(entry.mediaText);
          if (matches === void 0) {
            matches = defaultView ? defaultView.matchMedia(entry.mediaText).matches : false;
            matchMediaCache.set(entry.mediaText, matches);
          }
          if (matches) processEntries(entry.inner);
          continue;
        }
        try {
          if (!element.matches(entry.rule.selectorText)) continue;
        } catch (_ignored) {
          continue;
        }
        const style = entry.rule.style;
        for (const { jsKey, cssKey } of LAYOUT_STYLE_KEYS) {
          const value = style.getPropertyValue(cssKey);
          if (value) result[jsKey] = value.trim();
        }
      }
    }
    processEntries(entries);
    return result;
  }
  function getDeclaredLayoutStyles(element, cacheMap) {
    const ownerDoc = element.ownerDocument;
    if (typeof ownerDoc === "undefined" || !ownerDoc.styleSheets) return {};
    let cache = cacheMap.get(ownerDoc);
    if (!cache) {
      cache = buildStylesheetCache(ownerDoc);
      cacheMap.set(ownerDoc, cache);
    }
    return matchLayoutRules(element, cache, ownerDoc.defaultView ?? null);
  }

  // src/lib/core/snapshot.ts
  // Full pages with a real DOM can easily take more than ten seconds to walk.
  // A generous, foreground-only timeout avoids cutting off valid captures.
  var CAPTURE_TIMEOUT = 3e4;
  var DEFAULT_CONFIG = {
    assertLayoutValid: true,
    skipRemoteAssetSerialization: false,
    includeReactFiberTree: false,
    captureDeclaredStyles: false
  };
  var nodeIdCounter = 0;
  var nodeIdMap = /* @__PURE__ */ new WeakMap();
  function generateNodeId(node) {
    if (node !== null) {
      const existing = nodeIdMap.get(node);
      if (existing) return existing;
    }
    const id = `h2d-node-${++nodeIdCounter}`;
    if (node !== null) nodeIdMap.set(node, id);
    return id;
  }
  function getNodeId(element) {
    return nodeIdMap.get(element);
  }
  function safeRequestAnimationFrame(callback, signal) {
    if (signal.aborted) return;
    const frameId = requestAnimationFrame((timestamp) => {
      if (!signal.aborted) callback(timestamp);
    });
    signal.addEventListener("abort", () => cancelAnimationFrame(frameId), {
      once: true
    });
  }
  async function captureDOM(elementOrDocument, options) {
    const mergedOptions = { ...DEFAULT_CONFIG, ...options };
    const ctx = {
      captureDeclaredStyles: mergedOptions.captureDeclaredStyles === true,
      declaredStylesCache: mergedOptions.captureDeclaredStyles ? /* @__PURE__ */ new Map() : void 0
    };
    assertLayoutValid(mergedOptions);
    nodeIdCounter = 0;
    resetCaptureState();
    const assetCollector = new ResourceResolver(mergedOptions);
    const fontCollector = new TypefaceProbe();
    try {
      return await captureDOMInner(elementOrDocument, mergedOptions, ctx, assetCollector, fontCollector);
    } finally {
      cleanupCaptureState();
    }
  }
  async function captureDOMInner(elementOrDocument, mergedOptions, ctx, assetCollector, fontCollector) {
    if (elementOrDocument instanceof Element) {
      await prepareForCapture(elementOrDocument);
      await decodeImages(Array.from(elementOrDocument.querySelectorAll("img")));
      const serialized = await snapshotInAnimationFrame(
        elementOrDocument,
        assetCollector,
        fontCollector,
        mergedOptions,
        ctx
      );
      // Geometry is now frozen in `serialized`; restore the user's scroll
      // position before binary assets are encoded, which may take longer.
      cleanupCaptureState();
      const blobMap = await assetCollector.getBlobMap();
      const fonts = fontCollector.getFonts();
      const { width, height } = elementOrDocument.getBoundingClientRect();
      if (!serialized || serialized.nodeType !== NODE_TYPES.ELEMENT_NODE) {
        throw new Error("Container node could not be serialized");
      }
      const experimental = mergedOptions.includeReactFiberTree ? { reactFiberTree: extractComponentTree(elementOrDocument, getNodeId) } : void 0;
      return {
        root: serialized,
        documentTitle: document.title || void 0,
        experimental,
        documentRect: {
          x: 0,
          y: 0,
          width: elementOrDocument.scrollWidth,
          height: elementOrDocument.scrollHeight
        },
        viewportRect: {
          x: elementOrDocument.scrollLeft,
          y: elementOrDocument.scrollTop,
          width,
          height
        },
        devicePixelRatio: window.devicePixelRatio,
        assets: blobMap,
        fonts
      };
    } else if (elementOrDocument instanceof Document) {
      await prepareForCapture(elementOrDocument.documentElement);
      await decodeImages(Array.from(elementOrDocument.images));
      const serialized = await snapshotInAnimationFrame(
        elementOrDocument.documentElement,
        assetCollector,
        fontCollector,
        mergedOptions,
        ctx
      );
      cleanupCaptureState();
      const blobMap = await assetCollector.getBlobMap();
      const fonts = fontCollector.getFonts();
      if (!serialized || serialized.nodeType !== NODE_TYPES.ELEMENT_NODE) {
        throw new Error("Container node must have a body element");
      }
      const experimental = mergedOptions.includeReactFiberTree ? { reactFiberTree: extractComponentTree(elementOrDocument.documentElement, getNodeId) } : void 0;
      return {
        documentTitle: elementOrDocument.title || void 0,
        root: serialized,
        experimental,
        documentRect: {
          x: 0,
          y: 0,
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight
        },
        viewportRect: {
          x: 0,
          y: 0,
          width: window.innerWidth,
          height: window.innerHeight
        },
        devicePixelRatio: window.devicePixelRatio,
        assets: blobMap,
        fonts
      };
    }
    throw new Error("Container node must be an Element or Document");
  }
  function snapshotInAnimationFrame(element, assetCollector, fontCollector, options, ctx) {
    assertLayoutValid(options);
    const signal = options.timeoutSignal ?? AbortSignal.timeout(CAPTURE_TIMEOUT);
    return new Promise((resolve, reject) => {
      safeRequestAnimationFrame(
        () => resolve(snapshotNode(element, assetCollector, fontCollector, void 0, ctx)),
        signal
      );
      signal.addEventListener(
        "abort",
        () => reject(new CaptureError("requestAnimationFrame timed out", "PAGE_NOT_RESPONDING")),
        { once: true }
      );
    });
  }
  function snapshotNode(node, assetCollector, fontCollector, parentTransform, ctx) {
    if (Array.isArray(node) || node.nodeType === Node.TEXT_NODE) {
      return snapshotTextNode(node);
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      return snapshotElement(node, assetCollector, fontCollector, parentTransform, ctx);
    }
    if (node.nodeType !== Node.COMMENT_NODE) {
      console.warn(`Unsupported node type: ${node.nodeType}`);
    }
    return null;
  }
  function snapshotElement(element, assetCollector, fontCollector, parentTransform, ctx) {
    const childNodes = [];
    let svgContent;
    let placeholderUrl;
    let selectionSourceId;
    if (!isNodeVisible(element)) return null;
    const tag = element.tagName.toUpperCase();
    if (tag === "HEAD" || tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
      return null;
    }
    const sources = getSourceAnnotations(element);
    if (sources && sources.length > 0) {
      if (sources[0]?.type === "text" && element.childNodes.length === 1) {
        const textNode = snapshotTextNode(element.childNodes[0]);
        textNode.sources = sources;
        return textNode;
      }
      selectionSourceId = getInspectorSelectedId(element);
    }
    const computedStyles = diffStyles(element);
    if (tag === "HTML" && !computedStyles.backgroundColor && !computedStyles.backgroundImage) {
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      if (bodyBg && bodyBg !== "rgba(0, 0, 0, 0)") {
        computedStyles.backgroundColor = bodyBg;
      }
    }
    const displayValue = computedStyles.display;
    if (displayValue === "flex" || displayValue === "inline-flex") {
      ensureFlexProps(element, computedStyles);
    } else if (displayValue === "grid" || displayValue === "inline-grid") {
      ensureGridProps(element, computedStyles);
    }
    const parentDisplay = element.parentElement ? window.getComputedStyle(element.parentElement).display : "";
    if (parentDisplay === "flex" || parentDisplay === "inline-flex" || parentDisplay === "grid" || parentDisplay === "inline-grid") {
      ensureFlexItemProps(element, computedStyles);
    }
    const declaredStyles = ctx?.captureDeclaredStyles === true && ctx.declaredStylesCache ? getDeclaredLayoutStyles(element, ctx.declaredStylesCache) : {};
    const elementTransform = resolveTransform(computedStyles);
    const combinedTransform = multiplyMatrices(parentTransform, elementTransform);
    if (element instanceof SVGElement) {
      svgContent = bakeSvgStyles(element);
    } else if (element instanceof HTMLCanvasElement) {
      placeholderUrl = assetCollector.addCanvas(element);
    } else {
      const root = element.shadowRoot ?? element;
      for (const childOrGroup of iterateChildNodes(root)) {
        const serialized = snapshotNode(childOrGroup, assetCollector, fontCollector, combinedTransform, ctx);
        if (serialized != null) childNodes.push(serialized);
      }
    }
    let pseudoElementStyles;
    for (const pseudo of ["::before", "::after"]) {
      const pseudoComputed = window.getComputedStyle(element, pseudo);
      const contentValue = pseudoComputed.content;
      if (contentValue && contentValue !== "none" && contentValue !== "normal") {
        if (!pseudoElementStyles) pseudoElementStyles = {};
        const styles = diffStyles(element, pseudo);
        styles.content = contentValue;
        pseudoElementStyles[pseudo === "::before" ? "before" : "after"] = styles;
        resolveResources(element, styles, assetCollector);
        resolveFonts(element, styles, fontCollector);
      }
    }
    if (element instanceof HTMLInputElement && INPUT_TYPES_WITH_PLACEHOLDER.has(element.type) || element instanceof HTMLTextAreaElement) {
      if (element.placeholder) {
        if (!pseudoElementStyles) pseudoElementStyles = {};
        pseudoElementStyles.placeholder = diffStyles(element, "::placeholder");
      }
    }
    resolveResources(element, computedStyles, assetCollector);
    resolveFonts(element, computedStyles, fontCollector);
    const rect = getElementRect(element, computedStyles, combinedTransform);
    if (shouldPruneNode(element, rect, childNodes)) {
      return null;
    }
    const sizing = inferLayoutSizing(element, computedStyles, element.parentElement);
    const node = {
      nodeType: Node.ELEMENT_NODE,
      id: generateNodeId(element),
      tag,
      attributes: getElementAttributes(element),
      styles: computedStyles,
      rect,
      childNodes,
      content: svgContent,
      placeholderUrl,
      pseudoElementStyles,
      owningReactComponent: findParentComponent(element),
      sources,
      selectionSourceId,
      relativeTransform: elementTransform ? matrixToSimple(elementTransform) : void 0,
      layoutSizingHorizontal: sizing.horizontal,
      layoutSizingVertical: sizing.vertical
    };
    if (Object.keys(declaredStyles).length > 0) {
      node.declaredStyles = declaredStyles;
    }
    return node;
  }
  function snapshotTextNode(nodeOrNodes) {
    const { lineCount, ...rectWithoutLineCount } = getTextRect(nodeOrNodes);
    const text = Array.isArray(nodeOrNodes) ? nodeOrNodes.map((n) => n.textContent || "").join("") : nodeOrNodes.textContent || "";
    const identityNode = Array.isArray(nodeOrNodes) ? nodeOrNodes.length === 1 ? nodeOrNodes[0] : null : nodeOrNodes;
    return {
      nodeType: Node.TEXT_NODE,
      id: generateNodeId(identityNode),
      text,
      rect: rectWithoutLineCount,
      lineCount
    };
  }

  // src/lib/pipeline.ts
  var LOG_PREFIX = "[Web2Fig]";
  var SUBMIT_TIMEOUT = 6e4;
  var ERROR_MESSAGES = {
    CAPTURE_EXPIRED: "Capture expired. Please start a new capture.",
    CAPTURE_NOT_FOUND: "Capture not found. Please start a new capture.",
    ACCESS_DENIED: "Access denied. Please try again.",
    CAPTURE_ID_ALREADY_SUBMITTED: "Capture already submitted. Please start a new capture.",
    PAGE_NOT_RESPONDING: "Capture timed out. Try keeping this tab in the foreground.",
    VIDEO_TIMEOUT: "Request timed out. Please try again."
  };
  var logger = {
    verbose: false,
    log: (...args) => {
      if (logger.verbose) console.log(LOG_PREFIX, ...args);
    },
    error: (...args) => {
      if (logger.verbose) console.error(LOG_PREFIX, ...args);
    }
  };
  async function waitForDOMReady() {
    if (document.readyState === "loading") {
      logger.log("Waiting for DOM to be ready...");
      await new Promise(
        (resolve) => document.addEventListener("DOMContentLoaded", () => resolve())
      );
    }
  }
  function createVisibilityAwareSignal(timeout) {
    const controller = new AbortController();
    let remaining = timeout;
    let visibleSince = document.hidden ? null : Date.now();
    let timer = visibleSince ? scheduleAbort() : null;
    function cleanup() {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    }
    function scheduleAbort() {
      return setTimeout(() => {
        cleanup();
        controller.abort();
      }, remaining);
    }
    function onVisibilityChange() {
      if (document.hidden) {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
          remaining -= Date.now() - (visibleSince ?? Date.now());
          visibleSince = null;
        }
      } else {
        if (timer === null && remaining > 0) {
          visibleSince = Date.now();
          timer = scheduleAbort();
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    controller.signal.addEventListener("abort", cleanup, { once: true });
    return controller.signal;
  }
  async function capturePage(selector = "body") {
    await waitForDOMReady();
    const root = selector === "body" || selector === "html" ? document : document.querySelector(selector);
    if (!root) throw new Error(`Element not found: ${selector}`);
    logger.log("Serializing DOM...");
    let tree;
    try {
      const timeoutSignal = createVisibilityAwareSignal(3e4);
      tree = await captureDOM(root, { timeoutSignal });
    } catch (err) {
      if (err instanceof CaptureError) {
        throw new Error(ERROR_MESSAGES[err.code] || err.message);
      }
      throw err;
    }
    logger.log("Converting to JSON...");
    const json = await treeToJson(tree);
    const sizeKB = Math.round(json.length / 1024);
    logger.log(`Payload size: ${sizeKB} KB`);
    return json;
  }
  async function submitCapture(json, captureId, endpoint, captureIndex = 0) {
    logger.log("Sending captures to Figma...");
    const sizeKB = Math.round(json.length / 1024);
    logger.log(`Sending capture, total size: ${sizeKB} KB`);
    const url = endpoint.replace(
      /\/capture\/[^/]+\/submit/,
      `/capture/${captureId}/submit`
    );
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), SUBMIT_TIMEOUT);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captureId,
          payload: json,
          captureIndex
        }),
        signal: abortController.signal
      });
      clearTimeout(timer);
      if (!response.ok) {
        let message;
        try {
          const body = await response.json();
          if (body.errorCode) {
            message = ERROR_MESSAGES[body.errorCode] || body.errorCode;
          } else {
            message = body.error || response.statusText;
          }
        } catch (_parseErr) {
          message = await response.text().catch(() => response.statusText);
        }
        logger.error(`Server error (${response.status}): ${message}`);
        throw new Error(message);
      }
      const data = await response.json();
      if (data.error) {
        logger.error("Capture failed:", data.error);
        throw new Error(data.error);
      }
      logger.log("Success! Page has been captured and sent to Figma.");
      const claimUrl = data.claimUrl || data.fileUrl;
      if (claimUrl) logger.log(`Open your file: ${claimUrl}`);
      return { claimUrl, nextCaptureId: data.nextCaptureId };
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request timed out after ${SUBMIT_TIMEOUT / 1e3} seconds`);
      }
      throw err;
    }
  }
  async function waitForFocus() {
    if (!document.hasFocus()) {
      logger.log("Document not focused, waiting for focus...");
      await new Promise((resolve) => {
        window.addEventListener("focus", () => resolve(), { once: true });
      });
      logger.log("Document focused, proceeding with clipboard copy");
    }
  }
  async function writeToClipboard(json) {
    if (window.figma?.useHtmlClipboardEncoding !== false) {
      try {
        const htmlBlob = await wrapForClipboard(json);
        await waitForFocus();
        const item = new ClipboardItem({ "text/html": htmlBlob });
        await navigator.clipboard.write([item]);
        return;
      } catch (err) {
        logger.warn("HTML ClipboardItem write failed, falling back to writeText:", err);
      }
    }
    await waitForFocus();
    await navigator.clipboard.writeText(json);
  }

  // src/lib/config.ts
  var ALLOWED_FIGMA_DOMAINS = [
    "figma.com",
    "www.figma.com",
    "api.figma.com",
    "mcp.figma.com",
    "local.figma.engineering",
    "mcp.local.figma.engineering",
    "figdev.systems",
    "localhost"
  ];
  function isValidFigmaEndpoint(url) {
    try {
      const hostname = new URL(url).hostname;
      return ALLOWED_FIGMA_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }
  function parseHashParams() {
    const hash = window.location.hash;
    if (!hash.startsWith("#figmacapture")) {
      return { shouldCapture: false };
    }
    const parts = hash.slice(1).split("&");
    let captureId;
    let endpoint;
    let delay;
    let selector;
    let logPayload;
    let logVerbose;
    for (const part of parts) {
      const [key, value] = part.split("=");
      if (key === "figmacapture" && value) {
        captureId = decodeURIComponent(value);
      } else if (key === "figmaendpoint" && value) {
        endpoint = decodeURIComponent(value);
      } else if (key === "figmadelay" && value) {
        const parsed = parseInt(decodeURIComponent(value), 10);
        if (!isNaN(parsed) && parsed >= 0) {
          delay = parsed;
        }
      } else if (key === "figmaselector" && value) {
        selector = decodeURIComponent(value);
      } else if (key === "figmalogpayload") {
        logPayload = value !== "false";
      } else if (key === "figmalogverbose") {
        logVerbose = value !== "false";
      }
    }
    return {
      shouldCapture: true,
      captureId,
      endpoint,
      delay,
      selector,
      logPayload,
      logVerbose
    };
  }

  // src/lib/api.ts
  if (typeof window !== "undefined") {
    if (!window.figma) {
      window.figma = {};
    }
    window.figma.capturePage = capturePage;
    window.figma.submitCapture = submitCapture;
    window.figma.writeToClipboard = writeToClipboard;
    window.figma.wrapForClipboard = wrapForClipboard;
    window.figma.isValidFigmaEndpoint = isValidFigmaEndpoint;
    window.figma.parseHashParams = parseHashParams;
    window.figma.setVerbose = (enabled) => {
      logger.verbose = !!enabled;
    };
  }
})();
