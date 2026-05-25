// ==UserScript==
// @name         Horder Mod Buffer
// @namespace    https://hordes.io/
// @version      0.1.0
// @description  One-button buffer route helper for Hordes.io.
// @author       Siri
// @match        https://hordes.io/*
// @match        https://www.hordes.io/*
// @run-at       document-start
// @grant        unsafeWindow
// @inject-into  page
// ==/UserScript==

(function horderModBufferBootstrap() {
  "use strict";

  const MOD_VERSION = "0.1.0";
  const BOOT_KEY = "__HORDER_MOD_BUFFER_BOOTSTRAPPED__";
  const SANDBOX_BOOT_KEY = "__HORDER_MOD_BUFFER_SANDBOX_BOOTSTRAPPED__";
  const RUNTIME_KEY = "__HORDER_MOD_BUFFER_RUNTIME__";
  const PANEL_ID = "horder-mod-buffer-panel";
  const CLIENT_SOURCE_TAG = "horder-mod-buffer-runtime";
  const DEFAULT_CHOICE_TIMEOUT_MS = 12000;
  const DEFAULT_WORLD_TIMEOUT_MS = 18000;
  const AFTER_TELEPORT_FALLBACK_MS = 3500;
  const AFTER_INTERACT_DELAY_MS = 180;
  const AFTER_CHOICE_DELAY_MS = 650;
  const BETWEEN_BUFFS_MS = 1000;
  const AFTER_BUFFS_MS = 600;
  const DEFAULT_HOTKEY_CODE = "Digit1";

  const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

  if (pageWindow !== window) {
    if (window[SANDBOX_BOOT_KEY]) return;
    window[SANDBOX_BOOT_KEY] = true;
    const inject = () => {
      const parent = document.documentElement || document.head || document.body;
      if (!parent) {
        setTimeout(inject, 0);
        return;
      }
      const script = document.createElement("script");
      script.textContent = `(${horderModBufferBootstrap.toString()})();`;
      parent.appendChild(script);
      script.remove();
    };
    inject();
    return;
  }

  if (pageWindow[BOOT_KEY]) return;
  pageWindow[BOOT_KEY] = true;

  const originalFetch = pageWindow.fetch ? pageWindow.fetch.bind(pageWindow) : null;
  const state = {
    running: false,
    cancelToken: null,
    status: "대기",
    lastError: "",
    log: [],
    panel: null,
    shadow: null,
  };

  if (isPlayPage()) {
    installGameClientRuntimeHook();
    installHotkey();
    whenDomReady(initPanel);
  }

  pageWindow.HorderModBuffer = {
    version: MOD_VERSION,
    runToGuardstone: () => runBufferFlow("Guardstone"),
    runToHeadlessLanding: () => runBufferFlow("Headless Landing"),
    stop: cancelRunningFlow,
    status: () => ({
      version: MOD_VERSION,
      running: state.running,
      status: state.status,
      lastError: state.lastError,
      runtime: summarizeRuntime(),
      log: state.log.slice(-12),
    }),
  };

  function isPlayPage() {
    return /^\/play(?:\/|$)/.test(location.pathname);
  }

  function whenDomReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function installGameClientRuntimeHook() {
    installScriptInsertInterceptor();
    installScriptObserver();
    scanScriptTags();
  }

  function installScriptInsertInterceptor() {
    const NodeProto = pageWindow.Node && pageWindow.Node.prototype;
    if (!NodeProto || NodeProto.__horderBufferScriptInsertPatched) return;

    const originalAppendChild = NodeProto.appendChild;
    const originalInsertBefore = NodeProto.insertBefore;
    const originalReplaceChild = NodeProto.replaceChild;

    if (typeof originalAppendChild === "function") {
      NodeProto.appendChild = function horderBufferAppendChild(node) {
        if (interceptScriptBeforeInsert(this, node, null)) return node;
        return originalAppendChild.apply(this, arguments);
      };
    }

    if (typeof originalInsertBefore === "function") {
      NodeProto.insertBefore = function horderBufferInsertBefore(node, child) {
        if (interceptScriptBeforeInsert(this, node, child)) return node;
        return originalInsertBefore.apply(this, arguments);
      };
    }

    if (typeof originalReplaceChild === "function") {
      NodeProto.replaceChild = function horderBufferReplaceChild(node, child) {
        if (interceptScriptBeforeInsert(this, node, child)) {
          if (child && child.parentNode === this) child.remove();
          return child;
        }
        return originalReplaceChild.apply(this, arguments);
      };
    }

    Object.defineProperty(NodeProto, "__horderBufferScriptInsertPatched", {
      configurable: true,
      value: true,
    });
  }

  function installScriptObserver() {
    const root = document.documentElement || document;
    try {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!node || node.nodeType !== Node.ELEMENT_NODE) continue;
            if (node.tagName === "SCRIPT") {
              interceptScriptTag(node);
            } else if (typeof node.querySelectorAll === "function") {
              node.querySelectorAll("script[src]").forEach(interceptScriptTag);
            }
          }
        }
      });
      observer.observe(root, { childList: true, subtree: true });
    } catch (error) {
      markRuntimeError("observer", error);
    }

    document.addEventListener(
      "beforescriptexecute",
      (event) => {
        const script = event.target;
        if (!script || !script.getAttribute || script.dataset.horderBufferRuntimeHooked) return;
        const url = toUrl(script.getAttribute("src"));
        if (!url || !shouldPatchClientScript(url)) return;
        event.preventDefault();
        event.stopPropagation();
        interceptScriptTag(script);
      },
      true
    );
  }

  function scanScriptTags() {
    try {
      document.querySelectorAll("script[src]").forEach(interceptScriptTag);
    } catch (error) {
      markRuntimeError("scan", error);
    }
  }

  function interceptScriptBeforeInsert(parent, node, nextSibling) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE || node.tagName !== "SCRIPT") return false;
    if (!node.getAttribute || node.dataset.horderBufferRuntimeHooked) return false;

    const url = toUrl(node.getAttribute("src"));
    if (!url || !shouldPatchClientScript(url)) return false;

    node.dataset.horderBufferRuntimeHooked = "sync-blocked";
    loadAndPatchClientScript(parent, nextSibling, url, node.getAttribute("type") || "");
    return true;
  }

  function interceptScriptTag(script) {
    if (!script || !script.getAttribute || script.dataset.horderBufferRuntimeHooked) return;

    const url = toUrl(script.getAttribute("src"));
    if (!url || !shouldPatchClientScript(url)) return;

    const parent = script.parentNode;
    const nextSibling = script.nextSibling;
    const originalType = script.getAttribute("type") || "";
    script.dataset.horderBufferRuntimeHooked = "checking";

    try {
      script.type = "javascript/horder-buffer-blocked";
      if (parent) parent.removeChild(script);
    } catch (error) {
      markRuntimeError("remove-client-script", error);
      return;
    }

    loadAndPatchClientScript(parent, nextSibling, url, originalType);
  }

  function shouldPatchClientScript(url) {
    if (!url || url.origin !== location.origin) return false;
    const path = url.pathname.toLowerCase();
    return path.endsWith("/client.js") || path.endsWith("client.js");
  }

  function loadAndPatchClientScript(parent, nextSibling, url, originalType) {
    try {
      const source = loadScriptSourceSync(url);
      insertPatchedScript(parent, nextSibling, patchClientSource(source, url), url, originalType);
      return;
    } catch (error) {
      markRuntimeError("sync-load", error);
    }

    loadAndPatchClientScriptAsync(parent, nextSibling, url, originalType);
  }

  function loadScriptSourceSync(url) {
    const xhr = new pageWindow.XMLHttpRequest();
    xhr.open("GET", url.toString(), false);
    xhr.send(null);
    if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText)) {
      return xhr.responseText;
    }
    throw new Error(`client.js request failed: ${xhr.status}`);
  }

  async function loadAndPatchClientScriptAsync(parent, nextSibling, url, originalType) {
    try {
      if (!originalFetch) throw new Error("fetch unavailable");
      const response = await originalFetch(url.toString(), { credentials: "same-origin" });
      if (!response.ok) throw new Error(`client.js request failed: ${response.status}`);
      const source = await response.text();
      insertPatchedScript(parent, nextSibling, patchClientSource(source, url), url, originalType);
    } catch (error) {
      markRuntimeError("async-load", error);
      insertFallbackScript(parent, nextSibling, url, originalType);
    }
  }

  function insertPatchedScript(parent, nextSibling, source, url, originalType) {
    const targetParent = parent || document.head || document.documentElement;
    if (!targetParent) return;

    const replacement = document.createElement("script");
    replacement.dataset.horderBufferRuntimeHooked = "inlined";
    replacement.dataset.horderBufferRuntimeSource = shortScriptUrl(url);
    if (originalType && !/^(text|application)\/javascript$/i.test(originalType)) replacement.type = originalType;
    replacement.textContent = `${source}\n//# sourceURL=${url.toString()}#${CLIENT_SOURCE_TAG}`;

    if (nextSibling && nextSibling.parentNode === targetParent) {
      targetParent.insertBefore(replacement, nextSibling);
    } else {
      targetParent.appendChild(replacement);
    }
  }

  function insertFallbackScript(parent, nextSibling, url, originalType) {
    const targetParent = parent || document.head || document.documentElement;
    if (!targetParent) return;

    const fallback = document.createElement("script");
    fallback.dataset.horderBufferRuntimeHooked = "fallback";
    fallback.src = url.toString();
    if (originalType) fallback.type = originalType;

    if (nextSibling && nextSibling.parentNode === targetParent) {
      targetParent.insertBefore(fallback, nextSibling);
    } else {
      targetParent.appendChild(fallback);
    }
  }

  function patchClientSource(source, url) {
    let patched = String(source || "");
    const runtimeProbe = buildRuntimeProbeSource(shortScriptUrl(url));

    if (patched.includes("(()=>{")) {
      patched = patched.replace("(()=>{", `(()=>{${runtimeProbe}`);
    } else {
      markRuntimeError("patch", new Error("client wrapper marker not found"));
    }

    if (patched.includes("N3=t=>{I=t}")) {
      patched = patched.replace(
        "N3=t=>{I=t}",
        `N3=t=>{I=t;try{var r=window.${RUNTIME_KEY}=window.${RUNTIME_KEY}||{};r.engine=t;r.player=t&&t.player;r.ready=true;r.updatedAt=Date.now();r.hookHits=r.hookHits||{};r.hookHits.engineSetter=(r.hookHits.engineSetter||0)+1}catch(e){}}`
      );
    }

    return patched;
  }

  function buildRuntimeProbeSource(sourceLabel) {
    return [
      "try{",
      `var __hmbRt=window.${RUNTIME_KEY}=window.${RUNTIME_KEY}||{};`,
      `__hmbRt.version=${JSON.stringify(MOD_VERSION)};`,
      `__hmbRt.source=${JSON.stringify(sourceLabel)};`,
      "__hmbRt.hookHits=__hmbRt.hookHits||{};",
      "__hmbRt.errors=__hmbRt.errors||[];",
      "__hmbRt.readStore=function(store){var value;try{var unsub=store&&store.subscribe&&store.subscribe(function(v){value=v});if(typeof unsub==='function')unsub()}catch(e){}return value};",
      "__hmbRt.update=function(){try{var r=window.__HORDER_MOD_BUFFER_RUNTIME__=window.__HORDER_MOD_BUFFER_RUNTIME__||{};r.engine=typeof I!=='undefined'?I:null;r.player=r.engine&&r.engine.player||null;r.ready=!!(r.engine&&r.player&&typeof Mt!=='undefined'&&typeof Io==='function');r.activeWorld=typeof Gr!=='undefined'?r.readStore(Gr):'';r.updatedAt=Date.now();r.hookHits.update=(r.hookHits.update||0)+1}catch(e){try{__hmbRt.errors.push('update:'+((e&&e.message)||e))}catch(_){}}};",
      "__hmbRt.listEntities=function(){var out=[];try{var engine=typeof I!=='undefined'?I:null;var arr=engine&&engine.entities&&engine.entities.array||[];for(var i=0;i<arr.length;i++){var e=arr[i];if(!e)continue;var pos=e.pos||e.visualPosition||[];out.push({id:e.id,name:e.name||'',type:e.type,faction:e.faction,party:e.party,pos:[Number(pos[0])||0,Number(pos[1])||0,Number(pos[2])||0]})}}catch(err){try{__hmbRt.errors.push('listEntities:'+((err&&err.message)||err))}catch(_){}}return out};",
      "__hmbRt.getPlayerInfo=function(){try{var p=typeof I!=='undefined'&&I&&I.player;var pos=p&&(p.pos||p.visualPosition)||[];return p?{id:p.id,name:p.name||'',type:p.type,pos:[Number(pos[0])||0,Number(pos[1])||0,Number(pos[2])||0],target:p.target}:null}catch(e){return null}};",
      "__hmbRt.changeTarget=function(id){id=Number(id);try{if(typeof vr==='function')return vr(id)}catch(e){}try{return Io(Mt.clientPlayerChangeTarget.packData({target:id}))}catch(e){throw new Error('changeTarget failed: '+((e&&e.message)||e))}};",
      "__hmbRt.sendInteract=function(id){id=Number(id);try{return Io(Mt.clientPlayerInteract.packData({id:id}))}catch(e){throw new Error('sendInteract failed: '+((e&&e.message)||e))}};",
      "__hmbRt.getActiveWorld=function(){try{return typeof Gr!=='undefined'?__hmbRt.readStore(Gr):''}catch(e){return ''}};",
      "__hmbRt.useSkillbarSlot=function(slot){slot=Number(slot);try{if(!Number.isInteger(slot)||slot<1)throw new Error('invalid slot');var player=typeof I!=='undefined'&&I&&I.player;if(!player)throw new Error('player not ready');var settings=typeof fe!=='undefined'&&fe&&fe.skillbarsettings;var bar=settings&&settings[player.name];var skill=bar&&bar[slot-1];if(!skill||Number(skill.id)<0)throw new Error('empty skillbar slot '+slot);var info=Array.isArray(skill.info)?skill.info.slice():[];if(skill.item&&player.inventory&&typeof player.inventory.findFirstSlotOfType==='function'){var invSlot=player.inventory.findFirstSlotOfType(skill.item.type,skill.item.tier);if(invSlot===void 0)throw new Error('item for slot '+slot+' not found');info[0]=invSlot}var def=typeof zt!=='undefined'&&zt&&zt.get?zt.get(skill.id):null;if(def&&def.envCast>0&&typeof gu==='function'){gu(skill.id,def.range,def.envCast);return {ok:true,slot:slot,id:skill.id,env:true}}Io(Mt.clientPlayerSkill.packData({id:skill.id,info:info}));return {ok:true,slot:slot,id:skill.id,env:false}}catch(e){return {ok:false,slot:slot,reason:(e&&e.message)||String(e)}}};",
      "__hmbRt.update();",
      "setInterval(function(){try{__hmbRt.update()}catch(e){}},250);",
      "}catch(e){try{var r=window.__HORDER_MOD_BUFFER_RUNTIME__=window.__HORDER_MOD_BUFFER_RUNTIME__||{};r.errors=r.errors||[];r.errors.push('install:'+((e&&e.message)||e))}catch(_){}}",
    ].join("");
  }

  function initPanel() {
    if (document.getElementById(PANEL_ID)) return;
    if (!document.body) {
      setTimeout(initPanel, 100);
      return;
    }

    const host = document.createElement("div");
    host.id = PANEL_ID;
    host.style.cssText = [
      "all: initial",
      "position: fixed",
      "right: 10px",
      "bottom: 92px",
      "z-index: 2147483647",
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "pointer-events: auto",
    ].join(";");
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    state.panel = host;
    state.shadow = shadow;

    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        .panel {
          width: 218px;
          border: 1px solid rgba(129, 148, 168, 0.72);
          border-radius: 8px;
          background: rgba(12, 15, 20, 0.94);
          color: #e5e7eb;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.38);
          overflow: hidden;
        }
        .head {
          padding: 8px 10px;
          border-bottom: 1px solid rgba(129, 148, 168, 0.32);
          font-size: 12px;
          font-weight: 800;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .body { padding: 8px; }
        .buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }
        button {
          border: 1px solid rgba(148, 163, 184, 0.55);
          border-radius: 6px;
          background: #172033;
          color: #f8fafc;
          height: 34px;
          padding: 0 8px;
          font: 800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          cursor: pointer;
        }
        button:hover { border-color: #f8fafc; }
        button:disabled {
          cursor: default;
          opacity: 0.58;
        }
        .stop {
          margin-top: 6px;
          width: 100%;
          background: #2a1217;
          border-color: rgba(248, 113, 113, 0.55);
        }
        .status {
          margin-top: 7px;
          min-height: 32px;
          padding: 6px;
          border-radius: 6px;
          background: rgba(15, 23, 42, 0.74);
          color: #cbd5e1;
          font-size: 11px;
          line-height: 1.35;
          word-break: keep-all;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #64748b;
          flex: 0 0 auto;
        }
        .dot.ready { background: #22c55e; }
        .dot.busy { background: #f59e0b; }
        .dot.error { background: #ef4444; }
      </style>
      <div class="panel">
        <div class="head">
          <span>Buffer</span>
          <span id="dot" class="dot"></span>
        </div>
        <div class="body">
          <div class="buttons">
            <button id="guardstone" type="button">Guardstone</button>
            <button id="headless" type="button">Headless</button>
          </div>
          <button id="stop" class="stop" type="button">중지</button>
          <div id="status" class="status">대기</div>
        </div>
      </div>
    `;

    shadow.getElementById("guardstone").addEventListener("click", () => runBufferFlow("Guardstone"));
    shadow.getElementById("headless").addEventListener("click", () => runBufferFlow("Headless Landing"));
    shadow.getElementById("stop").addEventListener("click", cancelRunningFlow);
    updatePanel();
    setInterval(updatePanel, 600);
  }

  function installHotkey() {
    if (pageWindow.__horderBufferHotkeyInstalled) return;
    pageWindow.__horderBufferHotkeyInstalled = true;

    document.addEventListener(
      "keydown",
      (event) => {
        if (!event || event.defaultPrevented) return;
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.code !== DEFAULT_HOTKEY_CODE && event.key !== "1") return;
        if (isEditableTarget(event.target)) return;

        event.preventDefault();
        event.stopPropagation();
        runBufferFlow("Guardstone");
      },
      true
    );
  }

  function isEditableTarget(target) {
    if (!target || target === document || target === pageWindow) return false;
    const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
    if (!element) return false;
    if (element.isContentEditable) return true;
    const tagName = String(element.tagName || "").toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
    return Boolean(element.closest && element.closest("input,textarea,select,[contenteditable='true']"));
  }

  async function runBufferFlow(finalDestination) {
    if (state.running) return;

    const token = { cancelled: false };
    state.running = true;
    state.cancelToken = token;
    state.lastError = "";
    setStatus(`시작: ${finalDestination}`);

    try {
      await waitForRuntime(token);

      await openConjurer(token);
      await chooseDestination("Faivel", token);
      await waitForWorldOrFallback("Faivel", token);

      await useSkillbarSlot(4, token);
      await sleep(BETWEEN_BUFFS_MS, token);
      await useSkillbarSlot(5, token);
      await sleep(AFTER_BUFFS_MS, token);

      await openConjurer(token);
      await chooseDestination(finalDestination, token);
      setStatus(`완료: ${finalDestination}`);
    } catch (error) {
      if (token.cancelled) {
        setStatus("중지됨");
      } else {
        const message = (error && error.message) || String(error);
        state.lastError = message;
        setStatus(`오류: ${message}`);
      }
    } finally {
      state.running = false;
      state.cancelToken = null;
      updatePanel();
    }
  }

  function cancelRunningFlow() {
    if (state.cancelToken) state.cancelToken.cancelled = true;
    state.running = false;
    setStatus("중지 요청");
  }

  async function waitForRuntime(token) {
    const runtime = await waitFor(
      () => {
        const rt = getRuntime();
        return rt && rt.ready && typeof rt.sendInteract === "function" && typeof rt.listEntities === "function" ? rt : null;
      },
      15000,
      "런타임 연결 실패. 페이지를 새로고침해 주세요.",
      token
    );
    return runtime;
  }

  async function openConjurer(token) {
    const runtime = await waitForRuntime(token);
    const conjurer = await waitFor(
      () => findNearestConjurer(runtime),
      8000,
      "주변에서 Conjurer를 찾지 못했습니다.",
      token
    );

    setStatus(`Conjurer 선택: ${conjurer.name || conjurer.id}`);
    runtime.changeTarget(conjurer.id);
    await sleep(AFTER_INTERACT_DELAY_MS, token);
    runtime.sendInteract(conjurer.id);
    await waitFor(
      () => findChoiceElement("Teleport") || findChoiceElement("Faivel") || findChoiceElement("Guardstone") || findChoiceElement("Headless"),
      DEFAULT_CHOICE_TIMEOUT_MS,
      "Conjurer 대화창을 열지 못했습니다.",
      token
    );
  }

  async function chooseDestination(destination, token) {
    const element = await waitFor(
      () => findChoiceElement(destination),
      DEFAULT_CHOICE_TIMEOUT_MS,
      `${destination} 선택지를 찾지 못했습니다.`,
      token
    );

    setStatus(`이동 선택: ${destination}`);
    clickLikeUser(element);
    await sleep(AFTER_CHOICE_DELAY_MS, token);
  }

  async function waitForWorldOrFallback(worldName, token) {
    const runtime = getRuntime();
    if (!runtime || typeof runtime.getActiveWorld !== "function") {
      await sleep(AFTER_TELEPORT_FALLBACK_MS, token);
      return;
    }

    const normalizedTarget = normalizeText(worldName);
    const startedAt = Date.now();
    while (Date.now() - startedAt < DEFAULT_WORLD_TIMEOUT_MS) {
      throwIfCancelled(token);
      const active = normalizeText(runtime.getActiveWorld && runtime.getActiveWorld());
      if (active && active.includes(normalizedTarget)) {
        setStatus(`월드 확인: ${worldName}`);
        await sleep(1000, token);
        return;
      }
      await sleep(250, token);
    }

    setStatus(`${worldName} 확인 실패, 고정 대기`);
    await sleep(AFTER_TELEPORT_FALLBACK_MS, token);
  }

  async function useSkillbarSlot(slot, token) {
    throwIfCancelled(token);
    const runtime = await waitForRuntime(token);
    setStatus(`${slot}번 사용`);

    let result = null;
    if (typeof runtime.useSkillbarSlot === "function") {
      result = runtime.useSkillbarSlot(slot);
    }

    if (!result || !result.ok) {
      pressKey(String(slot));
      await sleep(120, token);
      setStatus(`${slot}번 키 입력`);
      return;
    }

    await sleep(120, token);
  }

  function findNearestConjurer(runtime) {
    const entities = runtime && runtime.listEntities ? runtime.listEntities() : [];
    const player = runtime && runtime.getPlayerInfo ? runtime.getPlayerInfo() : null;
    const playerPos = player && Array.isArray(player.pos) ? player.pos : null;

    const matches = entities.filter((entity) => {
      const text = normalizeText(entity && entity.name);
      return text === "conjurer" || text === "conjuer" || text.includes("conjurer") || text.includes("conjuer");
    });

    if (!matches.length) return null;
    if (!playerPos) return matches[0];

    return matches
      .map((entity) => ({ entity, distance: distance3(playerPos, entity.pos || []) }))
      .sort((a, b) => a.distance - b.distance)[0].entity;
  }

  function findChoiceElement(needle) {
    const target = normalizeText(needle);
    if (!target) return null;

    const selector = [
      "button",
      ".btn",
      ".choice",
      "[value]",
      "[role='button']",
    ].join(",");

    const nodes = Array.from(document.querySelectorAll(selector));
    const candidates = [];

    for (const node of nodes) {
      if (!isVisible(node)) continue;
      const text = normalizeText(node.innerText || node.textContent || "");
      if (!text || !text.includes(target)) continue;
      const clickable = node.closest("button,.btn,.choice,[role='button'],[value]") || node;
      if (!isVisible(clickable)) continue;
      candidates.push(clickable);
    }

    if (!candidates.length) return null;
    return candidates.sort((a, b) => elementScore(b, target) - elementScore(a, target))[0];
  }

  function elementScore(element, target) {
    const text = normalizeText(element.innerText || element.textContent || "");
    let score = 0;
    if (text === target) score += 100;
    if (text.includes(`teleport to ${target}`)) score += 60;
    if (element.classList && element.classList.contains("btn")) score += 20;
    if (element.classList && element.classList.contains("choice")) score += 10;
    if (element.hasAttribute && element.hasAttribute("value")) score += 10;
    return score;
  }

  function pressKey(key) {
    const codeMap = {
      "1": "Digit1",
      "2": "Digit2",
      "3": "Digit3",
      "4": "Digit4",
      "5": "Digit5",
      "6": "Digit6",
      "7": "Digit7",
      "8": "Digit8",
      "9": "Digit9",
      "0": "Digit0",
    };
    const code = codeMap[key] || `Key${key.toUpperCase()}`;
    const targets = [
      document.activeElement,
      document.querySelector("canvas"),
      document.body,
      document,
      pageWindow,
    ].filter(Boolean);

    for (const type of ["keydown", "keyup"]) {
      for (const target of targets) {
        try {
          const event = new KeyboardEvent(type, {
            key,
            code,
            bubbles: true,
            cancelable: true,
            composed: true,
          });
          target.dispatchEvent(event);
        } catch {
          // Continue dispatching to other targets.
        }
      }
    }
  }

  function clickLikeUser(element) {
    const target = element.closest("button,.btn,.choice,[role='button'],[value]") || element;
    const rect = target.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);

    for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: pageWindow,
        clientX: x,
        clientY: y,
      });
      target.dispatchEvent(event);
    }
  }

  function getRuntime() {
    return pageWindow[RUNTIME_KEY] || null;
  }

  function summarizeRuntime() {
    const runtime = getRuntime();
    if (!runtime) return { ready: false };
    return {
      ready: Boolean(runtime.ready),
      activeWorld: runtime.activeWorld || "",
      updatedAt: runtime.updatedAt || null,
      errors: Array.isArray(runtime.errors) ? runtime.errors.slice(-4) : [],
    };
  }

  function updatePanel() {
    if (!state.shadow) return;
    const status = state.shadow.getElementById("status");
    const dot = state.shadow.getElementById("dot");
    const guardstone = state.shadow.getElementById("guardstone");
    const headless = state.shadow.getElementById("headless");
    const stop = state.shadow.getElementById("stop");
    const runtime = getRuntime();

    if (status) status.textContent = state.status || "대기";
    if (guardstone) guardstone.disabled = state.running;
    if (headless) headless.disabled = state.running;
    if (stop) stop.disabled = !state.running;

    if (dot) {
      dot.className = "dot";
      if (state.lastError) dot.classList.add("error");
      else if (state.running) dot.classList.add("busy");
      else if (runtime && runtime.ready) dot.classList.add("ready");
    }
  }

  function setStatus(text) {
    state.status = String(text || "");
    state.log.push({ at: new Date().toISOString(), text: state.status });
    while (state.log.length > 30) state.log.shift();
    updatePanel();
  }

  function markRuntimeError(stage, error) {
    const runtime = (pageWindow[RUNTIME_KEY] = pageWindow[RUNTIME_KEY] || {});
    runtime.errors = runtime.errors || [];
    runtime.errors.push(`${stage}: ${(error && error.message) || String(error)}`);
    while (runtime.errors.length > 12) runtime.errors.shift();
  }

  function toUrl(input) {
    if (!input) return null;
    try {
      return new URL(String(input), location.href);
    } catch {
      return null;
    }
  }

  function shortScriptUrl(url) {
    try {
      return `${url.pathname}${url.search || ""}`;
    } catch {
      return String(url || "");
    }
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/[.]+$/g, "")
      .trim()
      .toLowerCase();
  }

  function isVisible(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = pageWindow.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0;
  }

  function distance3(a, b) {
    const dx = Number(a[0] || 0) - Number(b[0] || 0);
    const dy = Number(a[1] || 0) - Number(b[1] || 0);
    const dz = Number(a[2] || 0) - Number(b[2] || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  async function waitFor(producer, timeoutMs, errorMessage, token) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      throwIfCancelled(token);
      const value = producer();
      if (value) return value;
      await sleep(150, token);
    }
    throw new Error(errorMessage);
  }

  function sleep(ms, token) {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        done = true;
        resolve();
      }, ms);
      if (!token) return;
      const check = () => {
        if (done) return;
        if (token.cancelled) {
          done = true;
          clearTimeout(timer);
          reject(new Error("cancelled"));
        } else {
          setTimeout(check, 50);
        }
      };
      setTimeout(check, 50);
    });
  }

  function throwIfCancelled(token) {
    if (token && token.cancelled) throw new Error("cancelled");
  }
})();
