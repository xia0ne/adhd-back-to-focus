/**
 * 回神 · Back to Focus
 * Apple 风格可折叠可拖拽悬浮控制卡片 (Floating Widget)
 */

class FocusCapsule {
  constructor({ onNext, onPrev, onCheckpoint, onSnapback, onToggleTts, onChangeRate, onClose, onContinue }) {
    this.container = null;
    this.timer = null;
    this.pingIntervalMs = 2 * 60 * 1000; // 默认 2 分钟
    this.onNext = onNext;
    this.onPrev = onPrev;
    this.onCheckpoint = onCheckpoint;
    this.onSnapback = onSnapback;
    this.onToggleTts = onToggleTts;
    this.onChangeRate = onChangeRate;
    this.onClose = onClose;
    this.onContinue = onContinue;

    this.isCollapsed = false; // 是否处于折叠微型药丸态
    this.isPingActive = false; // 是否正在弹出注意力检查
    this.currentData = { current: 0, total: 1, checkpoint: null, ttsRate: 1.2, isTtsPlaying: false };

    this.render();
    this.setupDraggable();
    this.startPingTimer();
  }

  render() {
    if (document.getElementById('btf-widget-root')) return;

    const root = document.createElement('div');
    root.id = 'btf-widget-root';
    root.className = 'btf-widget-root';

    root.innerHTML = `
      <!-- 折叠态：微型药丸 -->
      <div class="btf-mini-pill" id="btf-mini-pill" title="点击展开回神面板 (可拖拽)">
        <span class="btf-mini-logo">⚓</span>
        <span class="btf-mini-text" id="btf-mini-pos">01/01</span>
        <span class="btf-mini-expand">⤢</span>
      </div>

      <!-- 展开态：Apple 风格悬浮控制卡片 -->
      <div class="btf-card" id="btf-card">
        <!-- 头部 (拖拽把手与折叠) -->
        <div class="btf-card-header" id="btf-card-drag-handle">
          <div class="btf-card-title">
            <span class="btf-logo-dot"></span>
            <span>回神 · 专注模式</span>
          </div>
          <div class="btf-header-actions">
            <button class="btf-icon-btn" id="btf-btn-minimize" title="折叠为小胶囊">─</button>
            <button class="btf-icon-btn" id="btf-btn-close" title="退出聚焦模式">✕</button>
          </div>
        </div>

        <!-- 注意力唤醒横幅 (默认隐藏，定时弹出) -->
        <div class="btf-ping-banner" id="btf-ping-banner">
          <div class="btf-ping-prompt">
            <span class="btf-ping-pulse"></span>
            <span>思维跟上了吗？</span>
          </div>
          <div class="btf-ping-btn-group">
            <button class="btf-ping-action-btn btf-ping-ok" id="btf-ping-ok">还在读</button>
            <button class="btf-ping-action-btn btf-ping-drift" id="btf-ping-drift">走神了 (回神)</button>
          </div>
        </div>

        <!-- 状态进度条 -->
        <div class="btf-status-row">
          <div class="btf-status-item">
            <span class="btf-status-label">当前进度</span>
            <span class="btf-status-val" id="btf-val-progress">01 / 01</span>
          </div>
          <div class="btf-status-divider"></div>
          <div class="btf-status-item">
            <span class="btf-status-label">理解检查点</span>
            <span class="btf-status-val btf-text-amber" id="btf-val-checkpoint">未设定</span>
          </div>
        </div>

        <!-- 操作区 1: 逐段导航 (大按键，易点击) -->
        <div class="btf-nav-row">
          <button class="btf-action-btn btf-btn-nav" id="btf-btn-prev">
            <span>↑ 上一段</span>
            <kbd class="btf-kbd-hint">K</kbd>
          </button>
          <button class="btf-action-btn btf-btn-nav" id="btf-btn-next">
            <span>↓ 下一段</span>
            <kbd class="btf-kbd-hint">J</kbd>
          </button>
        </div>

        <!-- 操作区 2: 元认知核心动作 (理解打卡 & 一键回神) -->
        <div class="btf-core-row">
          <button class="btf-action-btn btf-btn-checkpoint" id="btf-btn-checkpoint">
            <span class="btf-btn-icon">⚓</span>
            <span class="btf-btn-text">读懂了 · 存检查点</span>
            <kbd class="btf-kbd-hint">C</kbd>
          </button>
          <button class="btf-action-btn btf-btn-snapback" id="btf-btn-snapback">
            <span class="btf-btn-icon">↺</span>
            <span class="btf-btn-text" id="btf-snapback-text">一键回神</span>
            <kbd class="btf-kbd-hint">R</kbd>
          </button>
        </div>

        <!-- 操作区 3: 语音辅助阅读与语速 -->
        <div class="btf-tts-row">
          <button class="btf-action-btn btf-btn-tts" id="btf-btn-tts">
            <span id="btf-tts-icon">🔊</span>
            <span id="btf-tts-text">语音辅助朗读</span>
            <kbd class="btf-kbd-hint">S</kbd>
          </button>
          <div class="btf-rate-ctrl">
            <button class="btf-rate-btn" id="btf-rate-down" title="减速 (快捷键 [)">-</button>
            <span class="btf-rate-display" id="btf-rate-display">1.2x</span>
            <button class="btf-rate-btn" id="btf-rate-up" title="加速 (快捷键 ])">+</button>
          </div>
        </div>

        <!-- 临时微反馈 Toast -->
        <div class="btf-card-toast" id="btf-card-toast"></div>
      </div>
    `;

    document.body.appendChild(root);
    this.container = root;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.container;

    // 折叠与展开
    root.querySelector('#btf-mini-pill').addEventListener('click', (e) => {
      e.stopPropagation();
      this.setCollapsed(false);
    });

    root.querySelector('#btf-btn-minimize').addEventListener('click', (e) => {
      e.stopPropagation();
      this.setCollapsed(true);
    });

    root.querySelector('#btf-btn-close').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onClose) this.onClose();
    });

    // 导航按钮
    root.querySelector('#btf-btn-prev').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onPrev) this.onPrev();
    });

    root.querySelector('#btf-btn-next').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onNext) this.onNext();
    });

    // 核心操作
    root.querySelector('#btf-btn-checkpoint').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onCheckpoint) this.onCheckpoint();
    });

    root.querySelector('#btf-btn-snapback').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onSnapback) this.onSnapback();
    });

    // 语音与语速
    root.querySelector('#btf-btn-tts').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onToggleTts) this.onToggleTts();
    });

    root.querySelector('#btf-rate-down').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onChangeRate) this.onChangeRate(-0.1);
    });

    root.querySelector('#btf-rate-up').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onChangeRate) this.onChangeRate(0.1);
    });

    // 唤醒横幅动作
    root.querySelector('#btf-ping-ok').addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissPing();
      if (this.onContinue) this.onContinue();
    });

    root.querySelector('#btf-ping-drift').addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissPing();
      if (this.onSnapback) this.onSnapback();
    });
  }

  setCollapsed(collapsed) {
    this.isCollapsed = collapsed;
    const card = document.getElementById('btf-card');
    const pill = document.getElementById('btf-mini-pill');

    if (collapsed) {
      card.style.display = 'none';
      pill.style.display = 'flex';
    } else {
      pill.style.display = 'none';
      card.style.display = 'flex';
    }
  }

  updateProgress(current, total, checkpoint) {
    this.currentData.current = current;
    this.currentData.total = total;
    this.currentData.checkpoint = checkpoint;

    const miniPos = document.getElementById('btf-mini-pos');
    const valProgress = document.getElementById('btf-val-progress');
    const valCheckpoint = document.getElementById('btf-val-checkpoint');
    const snapbackText = document.getElementById('btf-snapback-text');

    const formattedProgress = `${String(current + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    if (miniPos) miniPos.textContent = formattedProgress;
    if (valProgress) valProgress.textContent = formattedProgress;

    if (valCheckpoint) {
      if (checkpoint !== null && checkpoint !== undefined) {
        valCheckpoint.textContent = `第 ${checkpoint + 1} 段 ⚓`;
      } else {
        valCheckpoint.textContent = '未设定';
      }
    }

    if (snapbackText) {
      if (checkpoint !== null && checkpoint !== undefined && checkpoint < current) {
        const delta = current - checkpoint;
        snapbackText.textContent = `一键回神 (退 ${delta} 段)`;
      } else {
        snapbackText.textContent = '一键回神';
      }
    }
  }

  updateTtsState(rate, isPlaying) {
    this.currentData.ttsRate = rate;
    this.currentData.isTtsPlaying = isPlaying;

    const rateDisplay = document.getElementById('btf-rate-display');
    const ttsBtn = document.getElementById('btf-btn-tts');
    const ttsText = document.getElementById('btf-tts-text');

    if (rateDisplay) rateDisplay.textContent = `${rate}x`;
    if (ttsBtn) ttsBtn.classList.toggle('btf-btn-active', isPlaying);
    if (ttsText) ttsText.textContent = isPlaying ? '暂停朗读' : '语音朗读';
  }

  updateTtsRate(rate, isPlaying) {
    this.updateTtsState(rate, isPlaying);
  }

  showToast(message, duration = 1500) {
    const toast = document.getElementById('btf-card-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('btf-toast-show');

    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('btf-toast-show');
    }, duration);
  }

  // 拖拽支持 (支持拖拽卡片或小胶囊至屏幕任意角落)
  setupDraggable() {
    const root = this.container;
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    const onMouseDown = (e) => {
      // 避免在按钮上触发拖拽
      if (e.target.closest('button, kbd, input')) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = root.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newLeft = Math.max(10, Math.min(window.innerWidth - root.offsetWidth - 10, initialLeft + dx));
      let newTop = Math.max(10, Math.min(window.innerHeight - root.offsetHeight - 10, initialTop + dy));

      root.style.left = `${newLeft}px`;
      root.style.top = `${newTop}px`;
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      root.style.transform = 'none';
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    // 头部把手和小球支持拖拽
    const handle = root.querySelector('#btf-card-drag-handle');
    const miniPill = root.querySelector('#btf-mini-pill');
    if (handle) handle.addEventListener('mousedown', onMouseDown);
    if (miniPill) miniPill.addEventListener('mousedown', onMouseDown);
  }

  startPingTimer() {
    this.stopPingTimer();
    this.timer = setTimeout(() => {
      this.triggerMindfulnessPing();
    }, this.pingIntervalMs);
  }

  stopPingTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  resetPingTimer() {
    this.dismissPing();
    this.startPingTimer();
  }

  triggerMindfulnessPing() {
    // 若当前是折叠态，唤醒时自动展开卡片展示提醒
    if (this.isCollapsed) {
      this.setCollapsed(false);
    }

    const banner = document.getElementById('btf-ping-banner');
    if (banner) {
      banner.classList.add('btf-ping-visible');
      this.isPingActive = true;
    }

    // 12 秒后若无操作自动隐退
    clearTimeout(this.autoDismissTimer);
    this.autoDismissTimer = setTimeout(() => {
      this.dismissPing();
    }, 12000);
  }

  dismissPing() {
    const banner = document.getElementById('btf-ping-banner');
    if (banner) {
      banner.classList.remove('btf-ping-visible');
    }
    this.isPingActive = false;
    this.startPingTimer();
  }

  collapsePing() {
    this.dismissPing();
  }

  get isExpanded() {
    return this.isPingActive;
  }

  destroy() {
    this.stopPingTimer();
    clearTimeout(this.toastTimer);
    clearTimeout(this.autoDismissTimer);
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

window.FocusCapsule = FocusCapsule;
