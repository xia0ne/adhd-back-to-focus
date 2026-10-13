/**
 * 回神 · Back to Focus
 * Content Script 主入口与核心调度器
 * 支持：点中的那条消息、流式重扫、记忆模式恢复、双击秒开
 */

(() => {
  let isEnabled = false;
  let currentIndex = 0;
  let blocks = [];

  let extractor = window.DOMExtractor;
  let spotlight = new window.SpotlightRenderer();
  let checkpointMgr = new window.CheckpointManager();
  let capsule = null;

  let pageClickBound = false;
  let contentObserver = null;
  let rescanTimer = null;
  let rescanSuppressDepth = 0;

  function isUserInputActive() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || active.isContentEditable) return true;
    if (active.closest('.ProseMirror, [contenteditable="true"]')) return true;
    return false;
  }

  function indexOfElement(el) {
    if (!el) return -1;
    return blocks.findIndex(block => block.element === el || block.element.contains(el));
  }

  function elementAt(index) {
    if (typeof index !== 'number' || index < 0 || index >= blocks.length) return null;
    return blocks[index].element;
  }

  function rememberScope(container) {
    if (!container) return;
    if (checkpointMgr.scopeContainer === container) return;
    checkpointMgr.scopeContainer = container;
    checkpointMgr.scopeId = extractor.containerScopeId(container);
  }

  function applySavedAnchors(saved) {
    if (!saved) return;
    if (typeof saved.checkpointIndex === 'number' && saved.checkpointIndex >= 0 && saved.checkpointIndex < blocks.length) {
      checkpointMgr.checkpointIndex = saved.checkpointIndex;
      checkpointMgr.checkpointMarkedAt = typeof saved.checkpointMarkedAt === 'number' ? saved.checkpointMarkedAt : null;
      spotlight.markCheckpointBadge(blocks[saved.checkpointIndex].element, { pulse: false });
    }
    if (typeof saved.sustainedIndex === 'number' && saved.sustainedIndex >= 0 && saved.sustainedIndex < blocks.length) {
      checkpointMgr.sustainedIndex = saved.sustainedIndex;
    }
  }

  function syncCapsule(activeBlock) {
    if (!capsule) return;
    capsule.updateProgress(
      currentIndex,
      blocks.length,
      checkpointMgr.getCheckpoint(),
      activeBlock || blocks[currentIndex] || null,
      {
        sustainedIndex: checkpointMgr.getSustainedIndex(),
        checkpointMarkedAt: checkpointMgr.checkpointMarkedAt,
        snapbackIndex: checkpointMgr.peekSnapbackTarget()
      }
    );
  }

  function enableFocusMode(explicitIndex = null, container = null, hintEl = null) {
    if (isEnabled) {
      if (container && container !== extractor.currentContainer) {
        switchReadingContainer(container, hintEl);
        return;
      }
      if (typeof explicitIndex === 'number' && explicitIndex >= 0 && explicitIndex < blocks.length) {
        updateActiveFocus(explicitIndex);
      } else if (hintEl) {
        const matched = indexOfElement(hintEl);
        if (matched !== -1 && matched !== currentIndex) updateActiveFocus(matched);
      }
      return;
    }

    const readingContainer = container || (hintEl && extractor.findReadingContainer(hintEl)) || undefined;
    blocks = extractor.scanAndIndex(readingContainer);
    if (!blocks || blocks.length === 0) {
      alert('未检测到足够的阅读文本，请在文章或 AI 对话页面开启。');
      return;
    }

    isEnabled = true;
    spotlight.init();
    rememberScope(extractor.currentContainer);

    const saved = checkpointMgr.loadSavedProgress();
    let initialIndex = 0;
    let isRestored = false;

    if (typeof explicitIndex === 'number') {
      initialIndex = Math.max(0, Math.min(blocks.length - 1, explicitIndex));
    } else if (hintEl) {
      const matched = indexOfElement(hintEl);
      if (matched !== -1) initialIndex = matched;
    } else if (saved && typeof saved.currentIndex === 'number' && saved.currentIndex >= 0 && saved.currentIndex < blocks.length) {
      initialIndex = saved.currentIndex;
      isRestored = true;
    }

    applySavedAnchors(saved);

    currentIndex = initialIndex;
    checkpointMgr.holdIndex(initialIndex);
    checkpointMgr.lastMoveTimestamp = Date.now();

    capsule = new window.FocusCapsule({
      onNext: () => {
        if (currentIndex < blocks.length - 1) updateActiveFocus(currentIndex + 1);
      },
      onPrev: () => {
        if (currentIndex > 0) updateActiveFocus(currentIndex - 1);
      },
      onCheckpoint: () => handleMarkCheckpoint(),
      onSnapback: () => handleSnapback(),
      onClose: () => disableFocusMode(),
      onRestart: () => handleRestartFromBeginning()
    });

    updateActiveFocus(currentIndex);
    bindPageInteractions();
    startContentObserver();

    if (isRestored) {
      capsule.showToast(`↺ 已恢复上次阅读进度 (第 ${currentIndex + 1} 段)`, 2000);
    }
  }

  function switchReadingContainer(container, hintEl) {
    if (!container) return;
    if (window.AIAdapters) window.AIAdapters.foldThinkingBlocks(container);
    const elements = extractor.collectElements(container);
    if (!elements.length) {
      if (capsule) capsule.showToast('这段没有足够的阅读文本', 1500);
      return;
    }

    rescanSuppressDepth += 1;
    try {
      extractor.currentContainer = container;
      blocks = extractor.commitBlocks(elements);
      spotlight.clearAllDrift();
      checkpointMgr.checkpointIndex = null;
      checkpointMgr.checkpointMarkedAt = null;
      checkpointMgr.sustainedIndex = null;
      checkpointMgr.lastMoveTimestamp = Date.now();
      rememberScope(container);

      const saved = checkpointMgr.loadSavedProgress();
      applySavedAnchors(saved);

      let index = 0;
      const matched = indexOfElement(hintEl);
      if (matched !== -1) index = matched;
      else if (saved && typeof saved.currentIndex === 'number' && saved.currentIndex >= 0 && saved.currentIndex < blocks.length) {
        index = saved.currentIndex;
      }

      currentIndex = index;
      checkpointMgr.holdIndex(index);
      startContentObserver();
      updateActiveFocus(index);
    } finally {
      setTimeout(() => {
        rescanSuppressDepth = Math.max(0, rescanSuppressDepth - 1);
      }, 0);
    }
  }

  function disableFocusMode() {
    if (!isEnabled) return;
    checkpointMgr.saveProgress(blocks.length);

    isEnabled = false;
    stopContentObserver();
    unbindPageInteractions();
    spotlight.destroy();
    if (capsule) {
      capsule.destroy();
      capsule = null;
    }
  }

  function toggleFocusMode() {
    if (isEnabled) disableFocusMode();
    else enableFocusMode();
  }

  function handleRestartFromBeginning() {
    checkpointMgr.reset();
    spotlight.clearAllDrift();
    document.querySelectorAll('.btf-checkpoint-badge').forEach(b => b.remove());
    document.querySelectorAll('.btf-has-checkpoint').forEach(el => el.classList.remove('btf-has-checkpoint'));
    updateActiveFocus(0);
    if (capsule) {
      capsule.showToast('已从第 1 段从头开始 ✦', 1500);
    }
  }

  function updateActiveFocus(index) {
    if (index < 0 || index >= blocks.length) return;

    currentIndex = index;
    checkpointMgr.setCurrentIndex(index);
    const activeBlock = blocks[index];

    spotlight.focus(activeBlock, blocks);
    checkpointMgr.saveProgress(blocks.length);
    syncCapsule(activeBlock);
  }

  function handleMarkCheckpoint() {
    const res = checkpointMgr.markCheckpoint();
    if (!res.success) return;
    const activeBlock = blocks[currentIndex];
    spotlight.markCheckpointBadge(activeBlock.element);
    checkpointMgr.saveProgress(blocks.length);
    syncCapsule(activeBlock);
    if (capsule) {
      capsule.showToast(`⚓ 已签收理解 (第 ${currentIndex + 1} 段)`, 1500);
    }
  }

  function handleSnapback() {
    const { targetIndex, driftDelta } = checkpointMgr.calculateSnapbackTarget();
    const toBlock = blocks[targetIndex];
    if (!toBlock) return;

    const skippedElements = [];
    if (targetIndex < currentIndex) {
      for (let i = targetIndex + 1; i <= currentIndex; i++) {
        if (blocks[i]) skippedElements.push(blocks[i].element);
      }
    }

    spotlight.triggerSnapbackEffect(toBlock.element, skippedElements);
    updateActiveFocus(targetIndex);

    if (capsule) {
      if (driftDelta > 0) {
        capsule.showToast(`↺ 回神！已从容倒退 ${driftDelta} 段`, 2000);
      } else {
        capsule.showToast(`已在最新检查点 (第 ${targetIndex + 1} 段)`, 1500);
      }
    }
  }

  function resolveLiveContainer() {
    const current = extractor.currentContainer;
    if (current && current.isConnected) return current;

    const scope = checkpointMgr.scopeId;
    if (!scope || scope.startsWith('ai:') || !window.CSS || !CSS.escape) return null;
    const host = document.querySelector(`[data-message-id="${CSS.escape(scope)}"]`);
    if (!host) return null;

    let next = host;
    if (window.AIAdapters && window.AIAdapters.detectPlatform() !== 'generic') {
      const containers = window.AIAdapters.getAIContainers(window.AIAdapters.detectPlatform());
      for (const candidate of containers) {
        if (candidate === host || host.contains(candidate)) {
          next = candidate;
          break;
        }
      }
    }
    extractor.currentContainer = next;
    checkpointMgr.scopeContainer = next;
    return next;
  }

  function rescanKeepingPlace() {
    if (!isEnabled) return;
    const container = resolveLiveContainer();
    if (!container) return;
    const previousEl = elementAt(currentIndex);
    const previousText = previousEl && previousEl.innerText ? previousEl.innerText.trim() : '';
    const checkpointEl = elementAt(checkpointMgr.checkpointIndex);
    const sustainedEl = elementAt(checkpointMgr.sustainedIndex);

    rescanSuppressDepth += 1;
    try {
      if (window.AIAdapters) window.AIAdapters.foldThinkingBlocks(container);
      const elements = extractor.collectElements(container);
      if (!elements.length) return;

      const unchanged = elements.length === blocks.length
        && elements.every((el, i) => blocks[i] && blocks[i].element === el);
      if (unchanged) {
        elements.forEach((el, i) => {
          blocks[i].text = el.innerText ? el.innerText.trim() : '';
        });
        syncCapsule();
        return;
      }

      blocks = extractor.commitBlocks(elements);
      if (checkpointEl) {
        const idx = blocks.findIndex(block => block.element === checkpointEl);
        checkpointMgr.checkpointIndex = idx === -1 ? null : idx;
        if (idx === -1) checkpointMgr.checkpointMarkedAt = null;
      }
      if (sustainedEl) {
        const idx = blocks.findIndex(block => block.element === sustainedEl);
        checkpointMgr.sustainedIndex = idx === -1 ? null : idx;
      }

      let nextIndex = previousEl ? blocks.findIndex(block => block.element === previousEl) : -1;
      if (nextIndex < 0 && previousText) {
        nextIndex = blocks.findIndex(block => block.text === previousText);
      }
      if (nextIndex < 0) nextIndex = Math.min(currentIndex, blocks.length - 1);
      const keptPlace = Boolean(blocks[nextIndex]) && (
        (previousEl && blocks[nextIndex].element === previousEl)
        || (previousText !== '' && blocks[nextIndex].text === previousText)
      );

      currentIndex = nextIndex;
      checkpointMgr.holdIndex(nextIndex);
      if (checkpointMgr.checkpointIndex !== null && blocks[checkpointMgr.checkpointIndex]) {
        spotlight.markCheckpointBadge(blocks[checkpointMgr.checkpointIndex].element, { pulse: false });
      }
      spotlight.reapplyDrift(blocks);
      spotlight.syncTheme();
      spotlight.focus(blocks[currentIndex], blocks, { scroll: !keptPlace });
      checkpointMgr.saveProgress(blocks.length);
      syncCapsule();
    } finally {
      setTimeout(() => {
        rescanSuppressDepth = Math.max(0, rescanSuppressDepth - 1);
      }, 0);
    }
  }

  function startContentObserver() {
    stopContentObserver();
    const root = extractor.currentContainer;
    if (!root || root === document.body || root === document.documentElement) return;

    const parent = root.parentElement;
    const observeTarget = parent && parent !== document.body && parent !== document.documentElement
      ? parent
      : root;

    contentObserver = new MutationObserver(() => {
      if (rescanSuppressDepth > 0) return;
      clearTimeout(rescanTimer);
      rescanTimer = setTimeout(() => {
        if (isEnabled) rescanKeepingPlace();
      }, 400);
    });
    contentObserver.observe(observeTarget, { childList: true, subtree: true, characterData: true });
  }

  function stopContentObserver() {
    clearTimeout(rescanTimer);
    rescanTimer = null;
    if (contentObserver) {
      contentObserver.disconnect();
      contentObserver = null;
    }
  }

  window.addEventListener('keydown', (e) => {
    if (isUserInputActive()) return;
    if (!isEnabled) return;

    switch (e.key) {
      case 'j':
      case 'J':
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < blocks.length - 1) updateActiveFocus(currentIndex + 1);
        break;

      case 'k':
      case 'K':
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) updateActiveFocus(currentIndex - 1);
        break;

      case 'c':
      case 'C':
        e.preventDefault();
        handleMarkCheckpoint();
        break;

      case 'r':
      case 'R':
        e.preventDefault();
        handleSnapback();
        break;

      case 'Escape':
        e.preventDefault();
        disableFocusMode();
        break;
    }
  });

  function onPageClick(e) {
    if (!isEnabled) return;
    if (e.target.closest('#btf-widget-root, #btf-capsule-root')) return;

    const blockEl = e.target.closest('[data-btf-index]');
    if (!blockEl || blockEl.dataset.btfIndex === undefined) return;
    const targetIdx = parseInt(blockEl.dataset.btfIndex, 10);
    if (!isNaN(targetIdx) && targetIdx !== currentIndex) {
      updateActiveFocus(targetIdx);
    }
  }

  function bindPageInteractions() {
    if (pageClickBound) return;
    document.addEventListener('click', onPageClick);
    pageClickBound = true;
  }

  function unbindPageInteractions() {
    if (!pageClickBound) return;
    document.removeEventListener('click', onPageClick);
    pageClickBound = false;
  }

  document.addEventListener('dblclick', (e) => {
    if (isUserInputActive()) return;
    if (e.target.closest('#btf-widget-root, #btf-capsule-root, button, input, a')) return;

    const targetEl = e.target.closest('tr, p, li, pre, blockquote, h1, h2, h3, h4');
    if (!targetEl) return;

    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }

    const container = extractor.findReadingContainer(targetEl);
    if (!isEnabled) {
      enableFocusMode(null, container, targetEl);
      return;
    }

    if (container && container !== extractor.currentContainer) {
      switchReadingContainer(container, targetEl);
      return;
    }

    let matchedIdx = indexOfElement(targetEl);
    if (matchedIdx === -1) {
      rescanKeepingPlace();
      matchedIdx = indexOfElement(targetEl);
    }
    if (matchedIdx !== -1 && matchedIdx !== currentIndex) {
      updateActiveFocus(matchedIdx);
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'TOGGLE_FOCUS') {
      toggleFocusMode();
      sendResponse({ status: 'ok', isEnabled });
    } else if (message.action === 'GET_STATUS') {
      sendResponse({ isEnabled });
    }
    return true;
  });
})();
