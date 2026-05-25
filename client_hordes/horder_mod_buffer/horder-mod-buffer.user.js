// ==UserScript==
// @name         Horder Mod Buffer
// @namespace    https://hordes.io/
// @version      0.2.1
// @description  One-button buffer route helper for Hordes.io.
// @author       Siri
// @match        https://hordes.io/*
// @match        https://www.hordes.io/*
// @run-at       document-start
// @grant        unsafeWindow
// @inject-into  page
// @updateURL    https://raw.githubusercontent.com/ycutil/hordes_kr_mod/main/client_hordes/horder_mod_buffer/horder-mod-buffer.user.js
// @downloadURL  https://raw.githubusercontent.com/ycutil/hordes_kr_mod/main/client_hordes/horder_mod_buffer/horder-mod-buffer.user.js
// ==/UserScript==

(function horderModBufferBootstrap() {
  "use strict";

  const MOD_VERSION = "0.2.1";
  const BOOT_KEY = "__HORDER_MOD_BUFFER_BOOTSTRAPPED__";
  const SANDBOX_BOOT_KEY = "__HORDER_MOD_BUFFER_SANDBOX_BOOTSTRAPPED__";
  const RUNTIME_KEY = "__HORDER_MOD_BUFFER_RUNTIME__";
  const KR_RUNTIME_KEY = "__HORDES_KR_RUNTIME__";
  const PANEL_ID = "horder-mod-buffer-panel";
  const CLIENT_SOURCE_TAG = "horder-mod-buffer-runtime";
  const DEFAULT_CHOICE_TIMEOUT_MS = 12000;
  const DEFAULT_WORLD_TIMEOUT_MS = 18000;
  const AFTER_TELEPORT_FALLBACK_MS = 3500;
  const AFTER_INTERACT_DELAY_MS = 180;
  const AFTER_CHOICE_DELAY_MS = 650;
  const AFTER_FAIVEL_TELEPORT_BUFF_DELAY_MS = 300;
  const BETWEEN_BUFFS_MS = 1000;
  const AFTER_BUFFS_MS = 600;
  const GUARDSTONE_HOTKEY_CODE = "Digit1";
  const HEADLESS_HOTKEY_CODE = "Digit2";
  const STORAGE_MINIMIZED_KEY = "horder_mod_buffer_minimized";
  const STORAGE_USE_SLOT4_KEY = "horder_mod_buffer_use_slot4";

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
    debugVisible: false,
    lastDebugText: "",
    minimized: readStoredBoolean(STORAGE_MINIMIZED_KEY, false),
    useSlot4: readStoredBoolean(STORAGE_USE_SLOT4_KEY, true),
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
      settings: {
        minimized: state.minimized,
        useSlot4: state.useSlot4,
      },
      runtime: summarizeRuntime(),
      log: state.log.slice(-12),
    }),
    diagnose: () => buildDiagnosticStatus(),
    debugReport: () => buildDebugReport(),
    debugText: () => buildDebugText(),
    showDebug: () => showDebugReport(),
    copyDebug: () => copyDebugReport(),
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
    if (!url) {
      return interceptInlineClientScriptBeforeInsert(parent, node, nextSibling);
    }

    if (!shouldPatchClientScript(url)) return false;

    node.dataset.horderBufferRuntimeHooked = "sync-blocked";
    loadAndPatchClientScript(parent, nextSibling, url, node.getAttribute("type") || "");
    return true;
  }

  function interceptScriptTag(script) {
    if (!script || !script.getAttribute || script.dataset.horderBufferRuntimeHooked) return;

    const url = toUrl(script.getAttribute("src"));
    if (!url) {
      interceptInlineClientScriptTag(script);
      return;
    }

    if (!shouldPatchClientScript(url)) return;

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

  function interceptInlineClientScriptBeforeInsert(parent, node, nextSibling) {
    const source = getInlineScriptSource(node);
    if (!shouldPatchInlineClientScript(source)) return false;

    node.dataset.horderBufferRuntimeHooked = "inline-blocked";
    insertPatchedInlineScript(parent, nextSibling, source, node.getAttribute("type") || "");
    return true;
  }

  function interceptInlineClientScriptTag(script) {
    const source = getInlineScriptSource(script);
    if (!shouldPatchInlineClientScript(source)) return;

    const parent = script.parentNode;
    const nextSibling = script.nextSibling;
    const originalType = script.getAttribute("type") || "";
    script.dataset.horderBufferRuntimeHooked = "inline-checking";

    try {
      script.type = "javascript/horder-buffer-inline-blocked";
      if (parent) parent.removeChild(script);
    } catch (error) {
      markRuntimeError("remove-inline-client-script", error);
      return;
    }

    insertPatchedInlineScript(parent, nextSibling, source, originalType);
  }

  function shouldPatchClientScript(url) {
    if (!url || url.origin !== location.origin) return false;
    const path = url.pathname.toLowerCase();
    return path.endsWith("/client.js") || path.endsWith("client.js");
  }

  function shouldPatchInlineClientScript(source) {
    if (!source || source.includes(RUNTIME_KEY)) return false;
    if (!source.includes("clientPlayerInteract")) return false;
    if (!source.includes("clientPlayerSkill")) return false;
    if (!source.includes("window.onload=async()=>")) return false;
    return source.includes("var Mt={") || source.includes("Mt={clientPlayerInput");
  }

  function getInlineScriptSource(script) {
    try {
      return String(script.textContent || "");
    } catch {
      return "";
    }
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

  function insertPatchedInlineScript(parent, nextSibling, source, originalType) {
    const targetParent = parent || document.head || document.documentElement;
    if (!targetParent) return;

    const replacement = document.createElement("script");
    replacement.dataset.horderBufferRuntimeHooked = "inline-inlined";
    replacement.dataset.horderBufferRuntimeSource = "inline-client";
    if (originalType && !/^(text|application)\/javascript$/i.test(originalType)) replacement.type = originalType;
    replacement.textContent = `${patchClientSource(source, "inline-client")}\n//# sourceURL=${location.origin}/client.js#${CLIENT_SOURCE_TAG}`;

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
    const runtimeProbe = buildRuntimeProbeSource(typeof url === "string" ? url : shortScriptUrl(url)) + buildPrototypeRuntimeSource();
    const prototypeRuntime = buildPrototypeRuntimeSource();

    if (patched.includes("(()=>{")) {
      patched = patched.replace("(()=>{", `(()=>{${runtimeProbe}`);
    } else {
      markRuntimeError("patch", new Error("client wrapper marker not found"));
    }

    patched = patchEngineSetter(patched);
    patched = patchEngineConstructorCall(patched);

    if (patched.includes("window.onload=async()=>{")) {
      patched = patched.replace(
        "window.onload=async()=>{",
        `window.onload=async()=>{if(window.__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__)return;window.__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__=true;${prototypeRuntime}`
      );
    } else {
      markRuntimeError("patch", new Error("window.onload marker not found"));
    }

    return patched;
  }

  function patchEngineSetter(source) {
    const replacement = (match, argName) => {
      const safeArg = /^[A-Za-z_$][\w$]*$/.test(argName) ? argName : "t";
      return `N3=${safeArg}=>{I=${safeArg};try{var r=window.${RUNTIME_KEY}=window.${RUNTIME_KEY}||{};if(typeof r.exposeEngine==='function')r.exposeEngine(${safeArg},'engineSetter');else{r.engine=${safeArg};r.player=${safeArg}&&${safeArg}.player;r.ready=!!(r.engine&&r.player);r.updatedAt=Date.now();r.hookHits=r.hookHits||{};r.hookHits.engineSetter=(r.hookHits.engineSetter||0)+1}}catch(e){try{var rr=window.${RUNTIME_KEY}=window.${RUNTIME_KEY}||{};rr.errors=rr.errors||[];rr.errors.push('engineSetter:'+((e&&e.message)||e))}catch(_){}}}`;
    };

    const patched = source.replace(/N3=([A-Za-z_$][\w$]*)=>\{I=\1\}/, replacement);
    if (patched === source) {
      markRuntimeError("patch", new Error("engine setter marker not found"));
    }
    return patched;
  }

  function patchEngineConstructorCall(source) {
    const patched = source.replace(
      /N3\(new ([A-Za-z_$][\w$]*)\(\{\}\)\)/,
      `N3(window.__HORDER_MOD_BUFFER_CAPTURE_ENGINE__(new $1({}),'engineConstructor'))`
    );
    if (patched === source) {
      markRuntimeError("patch", new Error("engine constructor marker not found"));
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
      "__hmbRt.exposeEngine=function(engine,hit){try{var r=window.__HORDER_MOD_BUFFER_RUNTIME__=window.__HORDER_MOD_BUFFER_RUNTIME__||{};r.engine=engine||r.engine||null;r.player=r.engine&&r.engine.player||r.player||null;r.ready=!!(r.engine&&r.player&&typeof Mt!=='undefined'&&typeof Io==='function');r.activeWorld=typeof Gr!=='undefined'?r.readStore(Gr):r.activeWorld||'';r.updatedAt=Date.now();r.hookHits=r.hookHits||{};hit=hit||'exposeEngine';r.hookHits[hit]=(r.hookHits[hit]||0)+1;try{r.engineKeys=r.engine?Object.getOwnPropertyNames(r.engine).slice(0,60):[]}catch(_){}}catch(e){try{__hmbRt.errors.push('exposeEngine:'+((e&&e.message)||e))}catch(_){}}};",
      "__hmbRt.captureEngine=function(engine,hit){try{__hmbRt.exposeEngine(engine,hit||'captureEngine')}catch(e){try{__hmbRt.errors.push('captureEngine:'+((e&&e.message)||e))}catch(_){}}return engine};",
      "window.__HORDER_MOD_BUFFER_CAPTURE_ENGINE__=function(engine,hit){try{return __hmbRt.captureEngine(engine,hit)}catch(e){return engine}};",
      "__hmbRt.installOnloadAutoStart=function(){try{if(__hmbRt.onloadAutoStartInstalled)return;__hmbRt.onloadAutoStartInstalled=true;__hmbRt.onloadAutoStartInstalledAt=Date.now();__hmbRt.hookHits.onloadAutoStartInstall=(__hmbRt.hookHits.onloadAutoStartInstall||0)+1;var attempts=0,currentOnload=window.onload,assignmentCount=0,timer=null;var isClientOnload=function(fn){try{if(typeof fn!=='function')return false;var text=Function.prototype.toString.call(fn);return text.indexOf('__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__')>=0||text.indexOf('game.bin')>=0||text.indexOf('new Fh')>=0}catch(e){return false}};var tryRun=function(reason){try{attempts+=1;__hmbRt.onloadAutoStartAttempts=attempts;__hmbRt.onloadAutoStartReason=reason;__hmbRt.onloadAutoStartReadyState=document.readyState;__hmbRt.onloadAutoStartOnloadType=typeof currentOnload;__hmbRt.onloadAutoStartAssignmentCount=assignmentCount;__hmbRt.onloadAutoStartIsClientOnload=isClientOnload(currentOnload);if(window.__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__){if(timer)clearInterval(timer);__hmbRt.onloadAutoStartStopped='already-started';return}if(document.readyState==='loading')return;if(typeof currentOnload!=='function')return;if(!isClientOnload(currentOnload)){__hmbRt.onloadAutoStartStopped='waiting-client-onload';return}__hmbRt.hookHits.onloadAutoStartRun=(__hmbRt.hookHits.onloadAutoStartRun||0)+1;currentOnload.call(window);if(timer)clearInterval(timer);__hmbRt.onloadAutoStartStopped='ran'}catch(e){try{__hmbRt.errors.push('onloadAutoStart:'+((e&&e.message)||e));__hmbRt.onloadAutoStartStopped='error';if(timer)clearInterval(timer)}catch(_){}}};try{var desc=Object.getOwnPropertyDescriptor(window,'onload');if(!desc||desc.configurable){Object.defineProperty(window,'onload',{configurable:true,enumerable:true,get:function(){return currentOnload},set:function(fn){currentOnload=fn;assignmentCount+=1;__hmbRt.onloadAutoStartAssignedAt=Date.now();__hmbRt.hookHits.onloadAutoStartAssign=(__hmbRt.hookHits.onloadAutoStartAssign||0)+1;setTimeout(function(){tryRun('assignment')},0)}});__hmbRt.onloadAutoStartDescriptor='installed'}else{__hmbRt.onloadAutoStartDescriptor='not-configurable'}}catch(e){__hmbRt.onloadAutoStartDescriptor='error:'+((e&&e.message)||e)}timer=setInterval(function(){tryRun('timer')},50);setTimeout(function(){try{if(!window.__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__){__hmbRt.onloadAutoStartStopped='timeout';if(timer)clearInterval(timer)}}catch(_){}},30000)}catch(e){try{__hmbRt.errors.push('installOnloadAutoStart:'+((e&&e.message)||e))}catch(_){}}};",
      "__hmbRt.installOnloadAutoStart();",
      "__hmbRt.update=function(){try{var r=window.__HORDER_MOD_BUFFER_RUNTIME__=window.__HORDER_MOD_BUFFER_RUNTIME__||{};var engine=typeof I!=='undefined'&&I?I:r.engine||null;r.engine=engine;r.player=engine&&engine.player||r.player||null;r.ready=!!(r.engine&&r.player&&typeof Mt!=='undefined'&&typeof Io==='function');r.activeWorld=typeof Gr!=='undefined'?r.readStore(Gr):r.activeWorld||'';r.updatedAt=Date.now();r.hookHits=r.hookHits||{};r.hookHits.update=(r.hookHits.update||0)+1}catch(e){try{__hmbRt.errors.push('update:'+((e&&e.message)||e))}catch(_){}}};",
      "__hmbRt.listEntities=function(){var out=[];try{var runtime=window.__HORDER_MOD_BUFFER_RUNTIME__||{};var engine=typeof I!=='undefined'&&I?I:runtime.engine||null;var arr=engine&&engine.entities&&engine.entities.array||[];for(var i=0;i<arr.length;i++){var e=arr[i];if(!e)continue;var pos=e.pos||e.visualPosition||[];out.push({id:e.id,name:e.name||'',type:e.type,faction:e.faction,party:e.party,pos:[Number(pos[0])||0,Number(pos[1])||0,Number(pos[2])||0]})}}catch(err){try{__hmbRt.errors.push('listEntities:'+((err&&err.message)||err))}catch(_){}}return out};",
      "__hmbRt.getPlayerInfo=function(){try{var runtime=window.__HORDER_MOD_BUFFER_RUNTIME__||{};var engine=typeof I!=='undefined'&&I?I:runtime.engine||null;var p=engine&&engine.player||runtime.player||null;var pos=p&&(p.pos||p.visualPosition)||[];return p?{id:p.id,name:p.name||'',type:p.type,pos:[Number(pos[0])||0,Number(pos[1])||0,Number(pos[2])||0],target:p.target}:null}catch(e){return null}};",
      "__hmbRt.changeTarget=function(id){id=Number(id);try{if(typeof vr==='function')return vr(id)}catch(e){}try{return Io(Mt.clientPlayerChangeTarget.packData({target:id}))}catch(e){throw new Error('changeTarget failed: '+((e&&e.message)||e))}};",
      "__hmbRt.sendInteract=function(id){id=Number(id);try{return Io(Mt.clientPlayerInteract.packData({id:id}))}catch(e){throw new Error('sendInteract failed: '+((e&&e.message)||e))}};",
      "__hmbRt.getActiveWorld=function(){try{return typeof Gr!=='undefined'?__hmbRt.readStore(Gr):''}catch(e){return ''}};",
      "__hmbRt.useSkillbarSlot=function(slot){slot=Number(slot);try{if(!Number.isInteger(slot)||slot<1)throw new Error('invalid slot');var runtime=window.__HORDER_MOD_BUFFER_RUNTIME__||{};var engine=typeof I!=='undefined'&&I?I:runtime.engine||null;var player=engine&&engine.player||runtime.player||null;if(!player)throw new Error('player not ready');var settings=typeof fe!=='undefined'&&fe&&fe.skillbarsettings;var bar=settings&&settings[player.name];var skill=bar&&bar[slot-1];if(!skill||Number(skill.id)<0)throw new Error('empty skillbar slot '+slot);var info=Array.isArray(skill.info)?skill.info.slice():[];if(skill.item&&player.inventory&&typeof player.inventory.findFirstSlotOfType==='function'){var invSlot=player.inventory.findFirstSlotOfType(skill.item.type,skill.item.tier);if(invSlot===void 0)throw new Error('item for slot '+slot+' not found');info[0]=invSlot}var def=typeof zt!=='undefined'&&zt&&zt.get?zt.get(skill.id):null;if(def&&def.envCast>0&&typeof gu==='function'){gu(skill.id,def.range,def.envCast);return {ok:true,slot:slot,id:skill.id,env:true}}Io(Mt.clientPlayerSkill.packData({id:skill.id,info:info}));return {ok:true,slot:slot,id:skill.id,env:false}}catch(e){return {ok:false,slot:slot,reason:(e&&e.message)||String(e)}}};",
      "__hmbRt.update();",
      "setInterval(function(){try{__hmbRt.update()}catch(e){}},250);",
      "}catch(e){try{var r=window.__HORDER_MOD_BUFFER_RUNTIME__=window.__HORDER_MOD_BUFFER_RUNTIME__||{};r.errors=r.errors||[];r.errors.push('install:'+((e&&e.message)||e))}catch(_){}}",
    ].join("");
  }

  function buildPrototypeRuntimeSource() {
    return [
      "try{",
      `var __hmbRt=window.${RUNTIME_KEY}=window.${RUNTIME_KEY}||{};`,
      "__hmbRt.hookHits=__hmbRt.hookHits||{};",
      "__hmbRt.errors=__hmbRt.errors||[];",
      "__hmbRt.prototypeInstallScheduledAt=__hmbRt.prototypeInstallScheduledAt||Date.now();",
      "var __hmbInstallPrototype=function(){try{__hmbRt.prototypeInstallAttempts=(__hmbRt.prototypeInstallAttempts||0)+1;if(typeof Fh==='undefined'||!Fh||!Fh.prototype)return false;__hmbRt.prototypePatchAt=Date.now();__hmbRt.prototypePatchFhType=typeof Fh;__hmbRt.prototypePatchFhKeys=Object.getOwnPropertyNames(Fh.prototype).slice(0,80);var __hmbExpose=function(engine,hit){try{var r=window.__HORDER_MOD_BUFFER_RUNTIME__=window.__HORDER_MOD_BUFFER_RUNTIME__||{};if(typeof r.exposeEngine==='function')r.exposeEngine(engine,hit);else{r.engine=engine;r.player=engine&&engine.player||null;r.updatedAt=Date.now();r.hookHits=r.hookHits||{};r.hookHits[hit]=(r.hookHits[hit]||0)+1}}catch(e){try{__hmbRt.errors.push('prototypeExpose:'+hit+':'+((e&&e.message)||e))}catch(_){}}};var __hmbWrap=function(name,hit){try{var proto=Fh&&Fh.prototype;var original=proto&&proto[name];if(typeof original!=='function')return;if(original.__horderBufferWrapped){__hmbRt.hookHits['wrap_'+hit+'_already']=(__hmbRt.hookHits['wrap_'+hit+'_already']||0)+1;return}var wrapped=function(){__hmbExpose(this,hit);var result=original.apply(this,arguments);__hmbExpose(this,hit+'After');return result};try{Object.defineProperty(wrapped,'__horderBufferWrapped',{value:true})}catch(_){}proto[name]=wrapped;__hmbRt.hookHits['wrap_'+hit]=(__hmbRt.hookHits['wrap_'+hit]||0)+1}catch(e){try{__hmbRt.errors.push('prototypeWrap:'+name+':'+((e&&e.message)||e))}catch(_){}}};__hmbWrap('setState','prototypeSetState');__hmbWrap('setPlayer','prototypeSetPlayer');__hmbWrap('tick','prototypeTick');__hmbWrap('manageChunks','prototypeManageChunks');return true}catch(e){try{__hmbRt.errors.push('prototypeRuntime:'+((e&&e.message)||e))}catch(_){}return true}};",
      "if(!__hmbRt.prototypeInstallTimerStarted){__hmbRt.prototypeInstallTimerStarted=true;var __hmbPrototypeTimer=setInterval(function(){try{if(__hmbInstallPrototype())clearInterval(__hmbPrototypeTimer)}catch(e){}},50)}",
      "__hmbInstallPrototype();",
      "}catch(e){try{var r=window.__HORDER_MOD_BUFFER_RUNTIME__=window.__HORDER_MOD_BUFFER_RUNTIME__||{};r.errors=r.errors||[];r.errors.push('prototypeRuntime:'+((e&&e.message)||e))}catch(_){}}",
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
        .head-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .minimize {
          width: 24px;
          height: 24px;
          padding: 0;
          border-radius: 5px;
          line-height: 1;
          background: #111827;
        }
        .body { padding: 8px; }
        .body.collapsed { display: none; }
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
        .option {
          display: flex;
          align-items: center;
          gap: 7px;
          min-height: 30px;
          margin-top: 6px;
          padding: 5px 7px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 6px;
          background: rgba(15, 23, 42, 0.58);
          color: #e2e8f0;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          user-select: none;
        }
        .option input {
          width: 14px;
          height: 14px;
          margin: 0;
        }
        .stop {
          margin-top: 6px;
          width: 100%;
          background: #2a1217;
          border-color: rgba(248, 113, 113, 0.55);
        }
        .debug-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          margin-top: 6px;
        }
        .debug-buttons button {
          height: 30px;
          background: #10251f;
          border-color: rgba(52, 211, 153, 0.48);
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
        .debug-output {
          display: none;
          width: 100%;
          height: 164px;
          margin-top: 7px;
          padding: 6px;
          border: 1px solid rgba(148, 163, 184, 0.48);
          border-radius: 6px;
          background: rgba(2, 6, 23, 0.88);
          color: #dbeafe;
          font: 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          line-height: 1.35;
          resize: vertical;
          white-space: pre;
        }
        .debug-output.open { display: block; }
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
          <span class="head-actions">
            <span id="dot" class="dot"></span>
            <button id="minimize" class="minimize" type="button">-</button>
          </span>
        </div>
        <div id="body" class="body">
          <div class="buttons">
            <button id="guardstone" type="button">Guardstone</button>
            <button id="headless" type="button">Headless</button>
          </div>
          <label class="option">
            <input id="use-slot4" type="checkbox">
            <span>4번도 사용</span>
          </label>
          <button id="stop" class="stop" type="button">중지</button>
          <div class="debug-buttons">
            <button id="debug" type="button">진단</button>
            <button id="copy-debug" type="button">복사</button>
          </div>
          <div id="status" class="status">대기</div>
          <textarea id="debug-output" class="debug-output" spellcheck="false" readonly></textarea>
        </div>
      </div>
    `;

    shadow.getElementById("guardstone").addEventListener("click", () => runBufferFlow("Guardstone"));
    shadow.getElementById("headless").addEventListener("click", () => runBufferFlow("Headless Landing"));
    shadow.getElementById("stop").addEventListener("click", cancelRunningFlow);
    shadow.getElementById("debug").addEventListener("click", showDebugReport);
    shadow.getElementById("copy-debug").addEventListener("click", copyDebugReport);
    shadow.getElementById("minimize").addEventListener("click", togglePanelMinimized);
    shadow.getElementById("use-slot4").addEventListener("change", (event) => setUseSlot4(Boolean(event.target.checked)));
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
        const destination = getHotkeyDestination(event);
        if (!destination) return;
        if (isEditableTarget(event.target)) return;

        event.preventDefault();
        event.stopPropagation();
        runBufferFlow(destination);
      },
      true
    );
  }

  function getHotkeyDestination(event) {
    if (event.code === GUARDSTONE_HOTKEY_CODE || event.key === "1") return "Guardstone";
    if (event.code === HEADLESS_HOTKEY_CODE || event.key === "2") return "Headless Landing";
    return "";
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
      await chooseDestination("Faivel", token, 0);
      setStatus("Faivel 이동 후 0.3초 대기");
      await sleep(AFTER_FAIVEL_TELEPORT_BUFF_DELAY_MS, token);

      if (state.useSlot4) {
        await useSkillbarSlot(4, token);
        await sleep(BETWEEN_BUFFS_MS, token);
      }
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

  function togglePanelMinimized() {
    state.minimized = !state.minimized;
    writeStoredBoolean(STORAGE_MINIMIZED_KEY, state.minimized);
    updatePanel();
  }

  function setUseSlot4(value) {
    state.useSlot4 = Boolean(value);
    writeStoredBoolean(STORAGE_USE_SLOT4_KEY, state.useSlot4);
    setStatus(state.useSlot4 ? "버프: 4번 + 5번" : "버프: 5번만");
  }

  async function waitForRuntime(token) {
    const runtime = await waitFor(
      () => {
        const rt = getRuntime();
        return rt && rt.ready && typeof rt.sendInteract === "function" && typeof rt.listEntities === "function" ? rt : null;
      },
      15000,
      buildRuntimeFailureMessage(),
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

  async function chooseDestination(destination, token, afterDelayMs = AFTER_CHOICE_DELAY_MS) {
    const element = await waitFor(
      () => findChoiceElement(destination),
      DEFAULT_CHOICE_TIMEOUT_MS,
      `${destination} 선택지를 찾지 못했습니다.`,
      token
    );

    setStatus(`이동 선택: ${destination}`);
    clickLikeUser(element);
    if (afterDelayMs > 0) await sleep(afterDelayMs, token);
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
    const runtime = pageWindow[RUNTIME_KEY] || null;
    if (runtime && runtime.ready) return runtime;

    const krRuntime = pageWindow[KR_RUNTIME_KEY];
    if (krRuntime && krRuntime.engine && krRuntime.player) {
      const target = pageWindow[RUNTIME_KEY] = runtime || {};
      target.engine = krRuntime.engine;
      target.player = krRuntime.player;
      target.activeWorld = krRuntime.activeWorld || "";
      target.updatedAt = Date.now();
      target.ready = false;
      target.krRuntimeSeen = true;
      if (!target.errors) target.errors = [];
      if (!target.errors.some((item) => String(item).includes("KR runtime"))) {
        target.errors.push("KR runtime found, but packet bridge is not available. Reload after updating buffer script.");
      }
      return target;
    }

    return runtime;
  }

  function summarizeRuntime() {
    const runtime = getRuntime();
    if (!runtime) return { ready: false };
    return {
      ready: Boolean(runtime.ready),
      activeWorld: runtime.activeWorld || "",
      updatedAt: runtime.updatedAt || null,
      errors: Array.isArray(runtime.errors) ? runtime.errors.slice(-4) : [],
      krRuntimeSeen: Boolean(runtime.krRuntimeSeen || pageWindow[KR_RUNTIME_KEY]),
    };
  }

  function buildDiagnosticStatus() {
    const runtime = getRuntime();
    return {
      version: MOD_VERSION,
      ready: Boolean(runtime && runtime.ready),
      bufferRuntime: summarizeRuntime(),
      krRuntimePresent: Boolean(pageWindow[KR_RUNTIME_KEY]),
      debugTextCommand: "HorderModBuffer.debugText()",
      copyCommand: "HorderModBuffer.copyDebug()",
      clientScripts: Array.from(document.querySelectorAll("script"))
        .map((script) => ({
          src: script.src || "",
          hook: script.dataset && script.dataset.horderBufferRuntimeHooked || "",
          source: script.dataset && script.dataset.horderBufferRuntimeSource || "",
          krHook: script.dataset && script.dataset.hordesKrRuntimeHooked || "",
          krSource: script.dataset && script.dataset.hordesKrRuntimeSource || "",
        }))
        .filter((item) => item.src.includes("client") || item.hook || item.krHook)
        .slice(-20),
    };
  }

  function buildDebugReport() {
    const runtime = getRuntime();
    const krRuntime = pageWindow[KR_RUNTIME_KEY] || null;
    const scripts = collectClientScriptDiagnostics();
    const player = runtime && typeof runtime.getPlayerInfo === "function"
      ? safeCall(() => runtime.getPlayerInfo(), null)
      : null;
    const entities = runtime && typeof runtime.listEntities === "function"
      ? safeCall(() => runtime.listEntities(), [])
      : [];
    const normalizedEntities = Array.isArray(entities) ? entities : [];
    const report = {
      generatedAt: new Date().toISOString(),
      version: MOD_VERSION,
      page: {
        href: location.href,
        pathname: location.pathname,
        readyState: document.readyState,
        visibilityState: document.visibilityState || "",
        userAgent: pageWindow.navigator && pageWindow.navigator.userAgent || "",
        clientOnloadStarted: Boolean(pageWindow.__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__),
      },
      panel: readPanelDiagnostics(),
      state: {
        running: state.running,
        status: state.status,
        lastError: state.lastError,
        minimized: state.minimized,
        useSlot4: state.useSlot4,
        log: state.log.slice(-12),
      },
      runtime: {
        present: Boolean(runtime),
        ready: Boolean(runtime && runtime.ready),
        source: runtime && runtime.source || "",
        activeWorld: runtime && runtime.activeWorld || "",
        updatedAt: runtime && runtime.updatedAt || null,
        updatedAgoMs: runtime && runtime.updatedAt ? Date.now() - runtime.updatedAt : null,
        hasEngine: Boolean(runtime && runtime.engine),
        hasPlayer: Boolean(runtime && runtime.player),
        functions: {
          changeTarget: Boolean(runtime && typeof runtime.changeTarget === "function"),
          sendInteract: Boolean(runtime && typeof runtime.sendInteract === "function"),
          useSkillbarSlot: Boolean(runtime && typeof runtime.useSkillbarSlot === "function"),
          listEntities: Boolean(runtime && typeof runtime.listEntities === "function"),
          getPlayerInfo: Boolean(runtime && typeof runtime.getPlayerInfo === "function"),
          getActiveWorld: Boolean(runtime && typeof runtime.getActiveWorld === "function"),
        },
        hookHits: runtime && runtime.hookHits || null,
        engineKeys: runtime && Array.isArray(runtime.engineKeys) ? runtime.engineKeys : [],
        prototypeInstallScheduledAt: runtime && runtime.prototypeInstallScheduledAt || null,
        prototypeInstallAttempts: runtime && runtime.prototypeInstallAttempts || 0,
        prototypeInstallTimerStarted: Boolean(runtime && runtime.prototypeInstallTimerStarted),
        prototypePatchAt: runtime && runtime.prototypePatchAt || null,
        prototypePatchFhType: runtime && runtime.prototypePatchFhType || "",
        prototypePatchFhKeys: runtime && Array.isArray(runtime.prototypePatchFhKeys) ? runtime.prototypePatchFhKeys : [],
        onloadAutoStartInstalled: Boolean(runtime && runtime.onloadAutoStartInstalled),
        onloadAutoStartInstalledAt: runtime && runtime.onloadAutoStartInstalledAt || null,
        onloadAutoStartAttempts: runtime && runtime.onloadAutoStartAttempts || 0,
        onloadAutoStartReason: runtime && runtime.onloadAutoStartReason || "",
        onloadAutoStartReadyState: runtime && runtime.onloadAutoStartReadyState || "",
        onloadAutoStartOnloadType: runtime && runtime.onloadAutoStartOnloadType || "",
        onloadAutoStartAssignmentCount: runtime && runtime.onloadAutoStartAssignmentCount || 0,
        onloadAutoStartAssignedAt: runtime && runtime.onloadAutoStartAssignedAt || null,
        onloadAutoStartIsClientOnload: Boolean(runtime && runtime.onloadAutoStartIsClientOnload),
        onloadAutoStartDescriptor: runtime && runtime.onloadAutoStartDescriptor || "",
        onloadAutoStartStopped: runtime && runtime.onloadAutoStartStopped || "",
        errors: runtime && Array.isArray(runtime.errors) ? runtime.errors.slice(-12) : [],
        krRuntimeSeen: Boolean(runtime && runtime.krRuntimeSeen),
      },
      krRuntime: {
        present: Boolean(krRuntime),
        hasEngine: Boolean(krRuntime && krRuntime.engine),
        hasPlayer: Boolean(krRuntime && krRuntime.player),
        keys: krRuntime ? Object.keys(krRuntime).sort().slice(0, 80) : [],
        patchedVersion: krRuntime && krRuntime.patchedVersion || "",
        hookHits: krRuntime && krRuntime.hookHits || null,
      },
      player,
      entities: {
        count: normalizedEntities.length,
        conjurers: normalizedEntities
          .filter((entity) => normalizeText(entity && entity.name).includes("conjuer") || normalizeText(entity && entity.name).includes("conjurer"))
          .slice(0, 8)
          .map(summarizeEntity),
        sample: normalizedEntities.slice(0, 8).map(summarizeEntity),
      },
      scripts,
    };
    report.possibleCauses = buildPossibleCauses(report);
    return report;
  }

  function buildDebugText() {
    return JSON.stringify(buildDebugReport(), null, 2);
  }

  function showDebugReport() {
    state.debugVisible = true;
    state.lastDebugText = buildDebugText();
    writeDebugOutput();
    setStatus("진단 리포트 생성");
    return state.lastDebugText;
  }

  async function copyDebugReport() {
    state.debugVisible = true;
    state.lastDebugText = buildDebugText();
    writeDebugOutput();

    let copied = false;
    try {
      if (pageWindow.navigator && pageWindow.navigator.clipboard && typeof pageWindow.navigator.clipboard.writeText === "function") {
        await pageWindow.navigator.clipboard.writeText(state.lastDebugText);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) copied = fallbackCopyDebugText();
    setStatus(copied ? "진단 복사됨" : "진단 표시됨: 텍스트를 직접 복사");
    return { copied, text: state.lastDebugText };
  }

  function writeDebugOutput() {
    if (!state.shadow) return;
    const output = state.shadow.getElementById("debug-output");
    if (!output) return;
    output.value = state.lastDebugText || "";
    output.classList.toggle("open", state.debugVisible);
    if (state.debugVisible) {
      try {
        output.focus();
        output.select();
      } catch {
        // Selection is only a convenience for manual copy.
      }
    }
  }

  function fallbackCopyDebugText() {
    if (!state.shadow) return false;
    const output = state.shadow.getElementById("debug-output");
    if (!output) return false;
    try {
      output.focus();
      output.select();
      return Boolean(document.execCommand && document.execCommand("copy"));
    } catch {
      return false;
    }
  }

  function readPanelDiagnostics() {
    const output = state.shadow && state.shadow.getElementById("debug-output");
    const dot = state.shadow && state.shadow.getElementById("dot");
    return {
      present: Boolean(state.panel),
      minimized: state.minimized,
      debugVisible: state.debugVisible,
      dotClass: dot && dot.className || "",
      debugOutputOpen: Boolean(output && output.classList.contains("open")),
    };
  }

  function collectClientScriptDiagnostics() {
    return Array.from(document.querySelectorAll("script"))
      .map((script, index) => {
        const text = script.src ? "" : script.textContent || "";
        return {
          index,
          src: script.src || "",
          type: script.type || "",
          hook: script.dataset && script.dataset.horderBufferRuntimeHooked || "",
          source: script.dataset && script.dataset.horderBufferRuntimeSource || "",
          krHook: script.dataset && script.dataset.hordesKrRuntimeHooked || "",
          krSource: script.dataset && script.dataset.hordesKrRuntimeSource || "",
          textLength: text.length,
          markers: {
            runtime: text.includes(RUNTIME_KEY),
            engineSetter: text.includes("engineSetter"),
            engineConstructor: text.includes("__HORDER_MOD_BUFFER_CAPTURE_ENGINE__"),
            prototypePatch: text.includes("prototypePatchFhType"),
            delayedPrototype: text.includes("prototypeInstallTimerStarted"),
            onloadGuard: text.includes("__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__"),
            onloadAutoStart: text.includes("onloadAutoStartRun"),
          },
        };
      })
      .filter((item) => item.src.includes("client") || item.hook || item.krHook)
      .slice(-30);
  }

  function buildPossibleCauses(report) {
    const causes = [];
    const hasBufferHook = report.scripts.some((script) => script.hook);
    const hasFallback = report.scripts.some((script) => script.hook === "fallback");
    const hasKrHook = report.scripts.some((script) => script.krHook);

    if (!report.runtime.present) {
      causes.push("Buffer runtime object 없음: Buffer가 client.js 패치에 성공하지 못했거나 너무 늦게 실행되었습니다.");
    }
    if (!hasBufferHook) {
      causes.push("client.js에 Buffer hook 표시가 없음: 유저스크립트가 document-start로 먼저 실행되지 않았을 가능성이 큽니다.");
    }
    if (hasFallback) {
      causes.push("fallback client.js가 삽입됨: client.js 다운로드/패치 중 오류가 있어 원본 스크립트로 되돌아갔습니다.");
    }
    if (hasKrHook || report.krRuntime.present) {
      causes.push("KR runtime/hook 감지됨: 버퍼 계정에서는 KR 모드를 끄고 Buffer만 켜야 합니다.");
    }
    if (report.runtime.present && !report.runtime.hasEngine) {
      causes.push("engine 미감지: client.js 내부 engine setter 패턴이 바뀌었거나 아직 캐릭터 접속이 완료되지 않았습니다.");
    }
    if (report.runtime.present && !report.runtime.hasPlayer) {
      causes.push("player 미감지: 캐릭터가 아직 월드에 들어오지 않았거나 런타임 update가 실패했습니다.");
    }
    if (report.runtime.present && !report.runtime.functions.sendInteract) {
      causes.push("sendInteract 함수 없음: packet bridge 설치가 실패했습니다.");
    }
    if (!causes.length && !report.runtime.ready) {
      causes.push("명확한 원인 없음: 리포트 전체를 전달해 주세요.");
    }
    return causes;
  }

  function summarizeEntity(entity) {
    const pos = entity && Array.isArray(entity.pos) ? entity.pos : [];
    return {
      id: entity && entity.id,
      name: entity && entity.name || "",
      type: entity && entity.type,
      pos: [Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0],
    };
  }

  function safeCall(fn, fallback) {
    try {
      const value = fn();
      return value === undefined ? fallback : value;
    } catch (error) {
      return {
        error: (error && error.message) || String(error),
      };
    }
  }

  function buildRuntimeFailureMessage() {
    const diagnostics = buildDiagnosticStatus();
    if (diagnostics.krRuntimePresent && !diagnostics.ready) {
      return "런타임 연결 실패. KR 모드가 client.js를 먼저 잡은 상태라 Buffer 패치가 필요합니다. 스크립트 업데이트 후 페이지를 완전 새로고침해 주세요.";
    }
    return "런타임 연결 실패. 스크립트 업데이트 후 페이지를 완전 새로고침해 주세요.";
  }

  function updatePanel() {
    if (!state.shadow) return;
    const status = state.shadow.getElementById("status");
    const dot = state.shadow.getElementById("dot");
    const guardstone = state.shadow.getElementById("guardstone");
    const headless = state.shadow.getElementById("headless");
    const stop = state.shadow.getElementById("stop");
    const debugOutput = state.shadow.getElementById("debug-output");
    const body = state.shadow.getElementById("body");
    const minimize = state.shadow.getElementById("minimize");
    const useSlot4 = state.shadow.getElementById("use-slot4");
    const runtime = getRuntime();

    if (status) status.textContent = state.status || "대기";
    if (guardstone) guardstone.disabled = state.running;
    if (headless) headless.disabled = state.running;
    if (stop) stop.disabled = !state.running;
    if (body) body.classList.toggle("collapsed", state.minimized);
    if (minimize) minimize.textContent = state.minimized ? "+" : "-";
    if (useSlot4) useSlot4.checked = state.useSlot4;
    if (debugOutput) {
      debugOutput.classList.toggle("open", state.debugVisible);
      if (state.debugVisible && state.lastDebugText && debugOutput.value !== state.lastDebugText) {
        debugOutput.value = state.lastDebugText;
      }
    }

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

  function readStoredBoolean(key, fallback) {
    try {
      const value = pageWindow.localStorage && pageWindow.localStorage.getItem(key);
      if (value === "1") return true;
      if (value === "0") return false;
    } catch {
      // Ignore storage access errors.
    }
    return fallback;
  }

  function writeStoredBoolean(key, value) {
    try {
      if (pageWindow.localStorage) pageWindow.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // Ignore storage access errors.
    }
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
