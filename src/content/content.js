/**
 * 回神 · Back to Focus
 * Content Script 主入口与核心调度器
 * 支持：记忆模式恢复、ADHD 专注冲刺钟、双击秒开与视口居中吸附
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

  // 启动聚焦模式 (支持记忆模式与指定初始段落)
  function enableFocusMode(explicitIndex = null) {
    if (isEnabled) {
      if (typeof explicitIndex === 'number' && explicitIndex >= 0 && explicitIndex < blocks.length) {
        updateActiveFocus(explicitIndex);
      }
      return;
    }
    
    blocks = extractor.scanAndIndex();
    if (!blocks || blocks.length === 0) {
      alert('未检测到足够的阅读文本，请在文章或 AI 对话页面开启。');
      return;
    }

    isEnabled = true;
    spotlight.init();

    let initialIndex = 0;
    let isRestored = false;

    if (explicitIndex !== null && typeof explicitIndex === 'number') {
      initialIndex = Math.max(0, Math.min(blocks.length - 1, explicitIndex));
    } else {
      // 记忆模式：检测当前页面是否有上次退出时的阅读记忆
      const saved = checkpointMgr.loadSavedProgress();
      if (saved && typeof saved.currentIndex === 'number' && saved.currentIndex < blocks.length) {
        initialIndex = saved.currentIndex;
        isRestored = true;
        // 恢复历史检查点
        if (saved.checkpointIndex !== null && saved.checkpointIndex < blocks.length) {
          checkpointMgr.checkpointIndex = saved.checkpointIndex;
          spotlight.markCheckpointBadge(blocks[saved.checkpointIndex].element);
        }
      }
    }

    currentIndex = initialIndex;

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
      },
      onRestart: () => handleRestartFromBeginning()
    });

    // 聚焦指定或记忆的阅读单元
    updateActiveFocus(currentIndex);
    bindPageInteractions();

    if (isRestored) {
      capsule.showToast(`↺ 已恢复上次阅读进度 (第 ${currentIndex + 1} 段)`, 2000);
    }
  }

  // 关闭聚焦模式
  function disableFocusMode() {
    if (!isEnabled) return;
    // 退出前自动固化当前阅读进度 (记忆模式)
    checkpointMgr.saveProgress(blocks.length);

    isEnabled = false;
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

  // 从头开始重置阅读记忆
  function handleRestartFromBeginning() {
    checkpointMgr.clearSavedProgress();
    checkpointMgr.checkpointIndex = null;
    document.querySelectorAll('.btf-checkpoint-badge').forEach(b => b.remove());
    document.querySelectorAll('.btf-has-checkpoint').forEach(el => el.classList.remove('btf-has-checkpoint'));
    updateActiveFocus(0);
    if (capsule) {
      capsule.showToast('已从第 1 段从头开始 ✦', 1500);
    }
  }

  // 更新当前聚焦，自动平滑居中跳转视口，并自动记忆进度
  function updateActiveFocus(index) {
    if (index < 0 || index >= blocks.length) return;

    currentIndex = index;
    checkpointMgr.setCurrentIndex(index);
    const activeBlock = blocks[index];

    // 聚光灯高亮与平滑视线居中
    spotlight.focus(activeBlock, blocks);

    // 自动固化进度 (记忆模式)
    checkpointMgr.saveProgress(blocks.length);

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
      checkpointMgr.saveProgress(blocks.length);

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
        enableFocusMode();
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

    // 寻找被双击文本所在的段落、列表项或表格行
    const targetEl = e.target.closest('tr, p, li, pre, blockquote, h1, h2, h3, h4');
    if (!targetEl) return;

    // 清除双击带来的文本选中蓝底
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }

    if (!isEnabled) {
      blocks = extractor.scanAndIndex();
      const matchedIdx = blocks.findIndex(b => b.element === targetEl || b.element.contains(targetEl));
      enableFocusMode(matchedIdx !== -1 ? matchedIdx : null);
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
