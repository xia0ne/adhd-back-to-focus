/**
 * 回神 · Back to Focus
 * Content Script 主入口与核心调度器
 */

(() => {
  let isEnabled = false;
  let currentIndex = 0;
  let blocks = [];

  let extractor = window.DOMExtractor;
  let spotlight = new window.SpotlightRenderer();
  let checkpointMgr = new window.CheckpointManager();
  let capsule = null;

  // 检查当前焦点是否在输入表单中（防止打字时触发快捷键）
  function isUserInputActive() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || active.isContentEditable) return true;
    if (active.closest('.ProseMirror, [contenteditable="true"]')) return true;
    return false;
  }

  // 启动聚焦模式 (支持指定初始段落索引)
  function enableFocusMode(targetIndex = 0) {
    if (isEnabled) {
      if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < blocks.length) {
        updateActiveFocus(targetIndex);
      }
      return;
    }
    
    blocks = extractor.scanAndIndex();
    if (!blocks || blocks.length === 0) {
      alert('未检测到足够的阅读文本，请在文章或 AI 对话页面开启。');
      return;
    }

    isEnabled = true;
    currentIndex = Math.max(0, Math.min(blocks.length - 1, targetIndex));
    spotlight.init();

    // 初始化 Apple 风格可折叠悬浮控制面板
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
      onContinue: () => {
        capsule.showToast('保持专注中 ✦', 1200);
      }
    });

    // 聚焦首个或指定阅读单元
    updateActiveFocus(currentIndex);
    bindPageInteractions();
  }

  // 关闭聚焦模式
  function disableFocusMode() {
    if (!isEnabled) return;
    isEnabled = false;
    spotlight.destroy();
    if (capsule) {
      capsule.destroy();
      capsule = null;
    }
    checkpointMgr.reset();
  }

  function toggleFocusMode() {
    if (isEnabled) disableFocusMode();
    else enableFocusMode(0);
  }

  // 更新当前聚焦，并自动平滑跳转视口
  function updateActiveFocus(index) {
    if (index < 0 || index >= blocks.length) return;

    currentIndex = index;
    checkpointMgr.setCurrentIndex(index);
    const activeBlock = blocks[index];

    // 聚光灯高亮与平滑视线居中
    spotlight.focus(activeBlock, blocks);

    // 同步更新悬浮框进度与预估时间
    if (capsule) {
      capsule.updateProgress(currentIndex, blocks.length, checkpointMgr.getCheckpoint(), activeBlock);
    }
  }

  // 标记理解检查点 (C)
  function handleMarkCheckpoint() {
    const res = checkpointMgr.markCheckpoint();
    if (res.success) {
      const activeBlock = blocks[currentIndex];
      spotlight.markCheckpointBadge(activeBlock.element);
      if (capsule) {
        capsule.updateProgress(currentIndex, blocks.length, res.index, activeBlock);
        capsule.showToast(`⚓ 已签收理解 (第 ${currentIndex + 1} 段)`, 1500);
        capsule.resetPingTimer();
      }
    }
  }

  // 一键回神 (R)
  function handleSnapback() {
    const { targetIndex, driftDelta, fallback } = checkpointMgr.calculateSnapbackTarget();
    const fromBlock = blocks[currentIndex];
    const toBlock = blocks[targetIndex];

    // 收集被跳过的段落元素，给予迷雾切断动效
    const skippedElements = [];
    if (targetIndex < currentIndex) {
      for (let i = targetIndex + 1; i <= currentIndex; i++) {
        if (blocks[i]) skippedElements.push(blocks[i].element);
      }
    }

    spotlight.triggerSnapbackEffect(fromBlock.element, toBlock.element, skippedElements);
    updateActiveFocus(targetIndex);

    if (capsule) {
      if (driftDelta > 0) {
        capsule.showToast(`↺ 回神！已从容倒退 ${driftDelta} 段`, 2000);
      } else {
        capsule.showToast(`已在最新检查点 (第 ${targetIndex + 1} 段)`, 1500);
      }
    }
  }

  // 键盘快捷键监听
  window.addEventListener('keydown', (e) => {
    // 若在输入框中打字，不干扰原生操作
    if (isUserInputActive()) return;

    // 未开启模式时，只响应切换快捷键
    if (!isEnabled) {
      if ((e.altKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        enableFocusMode(0);
      }
      return;
    }

    // 胶囊展开提示时的专用捕获
    if (capsule && capsule.isExpanded) {
      if (e.code === 'Space') {
        e.preventDefault();
        capsule.collapsePing();
        capsule.showToast('保持专注中 ✦', 1200);
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        capsule.collapsePing();
        handleSnapback();
        return;
      }
    }

    switch (e.key) {
      case 'j':
      case 'J':
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < blocks.length - 1) {
          updateActiveFocus(currentIndex + 1);
        }
        break;

      case 'k':
      case 'K':
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) {
          updateActiveFocus(currentIndex - 1);
        }
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

  // 支持用户点击页面段落直接定位焦点
  function bindPageInteractions() {
    document.addEventListener('click', (e) => {
      if (!isEnabled) return;
      if (e.target.closest('#btf-widget-root, #btf-capsule-root')) return;

      const blockEl = e.target.closest('[data-btf-index]');
      if (blockEl && blockEl.dataset.btfIndex !== undefined) {
        const targetIdx = parseInt(blockEl.dataset.btfIndex, 10);
        if (!isNaN(targetIdx) && targetIdx !== currentIndex) {
          updateActiveFocus(targetIdx);
        }
      }
    });
  }

  // 全局双击快速进入聚焦 (Zero-friction entry)
  document.addEventListener('dblclick', (e) => {
    if (isUserInputActive()) return;
    if (e.target.closest('#btf-widget-root, #btf-capsule-root, button, input, a')) return;

    // 寻找被双击文本所在的段落或列表项
    const targetEl = e.target.closest('p, li, pre, blockquote, h1, h2, h3, h4');
    if (!targetEl) return;

    if (!isEnabled) {
      // 开启聚焦并定位到被双击的段落
      enableFocusMode(0);
      const matchedIdx = blocks.findIndex(b => b.element === targetEl || b.element.contains(targetEl));
      if (matchedIdx !== -1) {
        updateActiveFocus(matchedIdx);
      }
    } else {
      const matchedIdx = blocks.findIndex(b => b.element === targetEl || b.element.contains(targetEl));
      if (matchedIdx !== -1 && matchedIdx !== currentIndex) {
        updateActiveFocus(matchedIdx);
      }
    }
  });

  // 监听来自 Service Worker 或 Popup 的通信指令
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
