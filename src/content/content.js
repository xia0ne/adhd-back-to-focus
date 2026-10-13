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
  let tts = new window.TTSEngine();
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

  // 启动聚焦模式
  function enableFocusMode() {
    if (isEnabled) return;
    
    blocks = extractor.scanAndIndex();
    if (!blocks || blocks.length === 0) {
      alert('未检测到足够的阅读文本，请在文章或 AI 对话页面开启。');
      return;
    }

    isEnabled = true;
    currentIndex = 0;
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
      onToggleTts: () => handleToggleTts(),
      onChangeRate: (delta) => handleRateChange(delta),
      onClose: () => disableFocusMode(),
      onContinue: () => {
        capsule.showToast('保持专注中 ✦', 1200);
      }
    });

    // 聚焦首个阅读单元
    updateActiveFocus(0);
    bindPageInteractions();
  }

  // 关闭聚焦模式
  function disableFocusMode() {
    if (!isEnabled) return;
    isEnabled = false;
    tts.stop();
    spotlight.destroy();
    if (capsule) {
      capsule.destroy();
      capsule = null;
    }
    checkpointMgr.reset();
  }

  function toggleFocusMode() {
    if (isEnabled) disableFocusMode();
    else enableFocusMode();
  }

  // 更新当前聚焦
  function updateActiveFocus(index) {
    if (index < 0 || index >= blocks.length) return;

    currentIndex = index;
    checkpointMgr.setCurrentIndex(index);
    const activeBlock = blocks[index];

    spotlight.focus(activeBlock, blocks);
    if (capsule) {
      capsule.updateProgress(currentIndex, blocks.length, checkpointMgr.getCheckpoint());
    }

    // 若当前正在播放朗读，切段时自动接续朗读新段落
    if (tts.isPlaying) {
      tts.speak(activeBlock.text, () => {
        // 可选：朗读完后可自动推进下一段
      });
    }
  }

  // 标记理解检查点 (C)
  function handleMarkCheckpoint() {
    const res = checkpointMgr.markCheckpoint();
    if (res.success) {
      const activeBlock = blocks[currentIndex];
      spotlight.markCheckpointBadge(activeBlock.element);
      if (capsule) {
        capsule.updateProgress(currentIndex, blocks.length, res.index);
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

    tts.stop();
    spotlight.triggerSnapbackEffect(fromBlock.element, toBlock.element);
    updateActiveFocus(targetIndex);

    if (capsule) {
      if (driftDelta > 0) {
        capsule.showToast(`↺ 回神！已从容倒退 ${driftDelta} 段`, 2000);
      } else {
        capsule.showToast(`已在最新检查点 (第 ${targetIndex + 1} 段)`, 1500);
      }
    }
  }

  // 切换朗读 (S)
  function handleToggleTts() {
    const activeBlock = blocks[currentIndex];
    if (!activeBlock) return;

    const isPlaying = tts.toggle(activeBlock.text, () => {
      if (capsule) capsule.updateTtsRate(tts.rate, false);
    });

    if (capsule) {
      capsule.updateTtsRate(tts.rate, isPlaying);
      capsule.showToast(isPlaying ? `开始朗读 (${tts.rate}x)` : '已暂停朗读', 1200);
    }
  }

  // 语速微调 ([ / ])
  function handleRateChange(delta) {
    const newRate = tts.changeRate(delta);
    if (capsule) {
      capsule.updateTtsRate(newRate, tts.isPlaying);
      capsule.showToast(`语速: ${newRate}x`, 1000);
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

      case 's':
      case 'S':
        e.preventDefault();
        handleToggleTts();
        break;

      case '[':
        e.preventDefault();
        handleRateChange(-0.1);
        break;

      case ']':
        e.preventDefault();
        handleRateChange(0.1);
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
