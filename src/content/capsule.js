/**
 * 回神 · Back to Focus
 * Apple 风格可折叠可拖拽悬浮控制卡片 (Floating Widget)
 * 集成：微感知耗时锚点、ADHD 番茄冲刺钟、拖拽记忆与从头重置
 */

class FocusCapsule {
  constructor({ onNext, onPrev, onCheckpoint, onSnapback, onClose, onContinue, onRestart }) {
    this.container = null;
    this.timer = null;
    this.pingIntervalMs = 2 * 60 * 1000; // 默认 2 分钟
    this.onNext = onNext;
    this.onPrev = onPrev;
    this.onCheckpoint = onCheckpoint;
    this.onSnapback = onSnapback;
    this.onClose = onClose;
    this.onContinue = onContinue;
    this.onRestart = onRestart;

    this.isCollapsed = false;
    this.isPingActive = false;
    this.currentData = { current: 0, total: 1, checkpoint: null };

    // 初始化 ADHD 专注冲刺番茄钟
    this.pomodoro = new window.PomodoroTimer({
      onTick: (data) => this.updatePomodoroUI(data),
      onFocusComplete: () => this.handlePomodoroFocusComplete(),
      onBreakComplete: () => this.handlePomodoroBreakComplete()
    });

    this.render();
    this.restoreSavedPosition();
    this.setupDraggable();
    this.startPingTimer();
  }

  render() {
    if (document.getElementById('btf-widget-root')) return;

    const root = document.createElement('div');
    root.id = 'btf-widget-root';
    root.className = 'btf-widget-root';

    root.innerHTML = `
      <!-- 折叠态：微型药丸 (可拖拽，点击展开) -->
      <div class="btf-mini-pill" id="btf-mini-pill" title="点击展开回神面板 (可拖拽)">
        <span class="btf-mini-logo">⚓</span>
        <span class="btf-mini-text" id="btf-mini-pos">01/01</span>
        <span class="btf-mini-pomo" id="btf-mini-pomo">⏳ 15:00</span>
        <span class="btf-mini-expand">⤢</span>
      </div>

      <!-- 展开态：Apple 风格悬浮控制卡片 -->
      <div class="btf-card" id="btf-card">
        <!-- 头部 (拖拽把手、番茄冲刺胶囊与折叠控制) -->
        <div class="btf-card-header" id="btf-card-drag-handle">
          <div class="btf-card-title">
            <span class="btf-logo-dot"></span>
            <span>回神</span>
          </div>
          
          <div class="btf-header-actions">
            <!-- ADHD 专注冲刺番茄钟胶囊 -->
            <div class="btf-pomodoro-pill" id="btf-pomo-pill" title="单击: 开始/暂停专注 | 双击: 切换 10 / 15 / 25 分钟">
              <span class="btf-pomo-icon" id="btf-pomo-icon">⏳</span>
              <span class="btf-pomo-time" id="btf-pomo-time">15:00</span>
            </div>
            
            <button class="btf-icon-btn" id="btf-btn-minimize" title="折叠为小胶囊">─</button>
            <button class="btf-icon-btn" id="btf-btn-close" title="退出聚焦模式">✕</button>
          </div>
        </div>

        <!-- 番茄钟休息提醒横幅 (冲刺完成后滑出) -->
        <div class="btf-pomo-banner" id="btf-pomo-banner">
          <div class="btf-pomo-prompt">
            <span>✨ 冲刺达成！给大脑深呼吸 3 分钟 ☕</span>
          </div>
          <div class="btf-pomo-btn-group">
            <button class="btf-pomo-action-btn btf-pomo-break-btn" id="btf-btn-pomo-break">开始休息 (3分)</button>
            <button class="btf-pomo-action-btn btf-pomo-continue-btn" id="btf-btn-pomo-continue">继续阅读</button>
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

        <!-- 状态进度行 -->
        <div class="btf-status-row">
          <div class="btf-status-item">
            <div class="btf-status-header-line">
              <span class="btf-status-label">当前进度</span>
              <button class="btf-restart-btn" id="btf-btn-restart" title="从第 1 段从头开始">重置</button>
            </div>
            <span class="btf-status-val" id="btf-val-progress">01 / 01</span>
          </div>
          <div class="btf-status-divider"></div>
          <div class="btf-status-item">
            <span class="btf-status-label">理解检查点</span>
            <span class="btf-status-val btf-text-amber" id="btf-val-checkpoint">未设定</span>
          </div>
        </div>

        <!-- 段落字数与阅读预估时间 (ADHD 时间感知锚点，降低心理负担) -->
        <div class="btf-pacing-row" id="btf-pacing-row">
          <span class="btf-pacing-icon">⏱</span>
          <span class="btf-pacing-text" id="btf-pacing-text">准备开始阅读</span>
        </div>

        <!-- 操作区 1: 逐段导航 (大按键，点击直接平滑吸附定位) -->
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

    // 从头重置按钮
    root.querySelector('#btf-btn-restart').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onRestart) this.onRestart();
    });

    // 番茄冲刺钟操作：单击启停，双击换挡
    const pomoPill = root.querySelector('#btf-pomo-pill');
    let clickTimeout = null;
    pomoPill.addEventListener('click', (e) => {
      e.stopPropagation();
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
        // 双击：换挡 (15m -> 10m -> 25m)
        this.pomodoro.cycleDuration();
        this.showToast(`冲刺时长: ${this.pomodoro.focusMinutes} 分钟`, 1000);
      } else {
        clickTimeout = setTimeout(() => {
          clickTimeout = null;
          // 单击：启停
          this.pomodoro.toggle();
          const running = this.pomodoro.state === 'RUNNING';
          this.showToast(running ? '专注计时已开启' : '计时已暂停', 1000);
        }, 220);
      }
    });

    // 休息横幅按钮
    root.querySelector('#btf-btn-pomo-break').addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissPomodoroBanner();
      this.pomodoro.startBreak(3);
      this.showToast('开启 3 分钟放松休息 ☕', 1500);
    });

    root.querySelector('#btf-btn-pomo-continue').addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissPomodoroBanner();
      this.pomodoro.reset();
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

  updatePomodoroUI({ formatted, state }) {
    const timeEl = document.getElementById('btf-pomo-time');
    const iconEl = document.getElementById('btf-pomo-icon');
    const pillEl = document.getElementById('btf-pomo-pill');
    const miniPomo = document.getElementById('btf-mini-pomo');

    if (timeEl) timeEl.textContent = formatted;
    if (miniPomo) miniPomo.textContent = `${state === 'BREAK' ? '☕' : '⏳'} ${formatted}`;

    if (pillEl) {
      pillEl.classList.toggle('btf-pomo-running', state === 'RUNNING');
      pillEl.classList.toggle('btf-pomo-break', state === 'BREAK');
    }
    if (iconEl) {
      if (state === 'BREAK') iconEl.textContent = '☕';
      else if (state === 'RUNNING') iconEl.textContent = '🔥';
      else iconEl.textContent = '⏳';
    }
  }

  handlePomodoroFocusComplete() {
    if (this.isCollapsed) {
      this.setCollapsed(false);
    }
    const banner = document.getElementById('btf-pomo-banner');
    if (banner) {
      banner.classList.add('btf-pomo-visible');
    }
  }

  handlePomodoroBreakComplete() {
    this.showToast('休息结束，准备好重新回神了吗？✦', 2000);
    this.dismissPomodoroBanner();
  }

  dismissPomodoroBanner() {
    const banner = document.getElementById('btf-pomo-banner');
    if (banner) {
      banner.classList.remove('btf-pomo-visible');
    }
  }

  setCollapsed(collapsed) {
    this.isCollapsed = collapsed;
    const card = document.getElementById('btf-card');
    const pill = document.getElementById('btf-mini-pill');

    if (collapsed) {
      if (card) card.style.display = 'none';
      if (pill) pill.style.display = 'flex';
    } else {
      if (pill) pill.style.display = 'none';
      if (card) card.style.display = 'flex';
    }
  }

  updateProgress(current, total, checkpoint, activeBlock = null) {
    this.currentData.current = current;
    this.currentData.total = total;
    this.currentData.checkpoint = checkpoint;

    const miniPos = document.getElementById('btf-mini-pos');
    const valProgress = document.getElementById('btf-val-progress');
    const valCheckpoint = document.getElementById('btf-val-checkpoint');
    const snapbackText = document.getElementById('btf-snapback-text');
    const pacingText = document.getElementById('btf-pacing-text');

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

    // 计算当前段落阅读预估时长
    if (pacingText && activeBlock && activeBlock.text) {
      const charCount = activeBlock.text.length;
      // 中文平均阅读速度约 350-400字/分 (约 6字/秒)
      const estSeconds = Math.max(4, Math.round(charCount / 6));
      if (estSeconds < 60) {
        pacingText.textContent = `本段约 ${estSeconds} 秒 · ${charCount} 字`;
      } else {
        const mins = (estSeconds / 60).toFixed(1);
        pacingText.textContent = `本段约 ${mins} 分钟 · ${charCount} 字`;
      }
    }
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

  // 恢复之前保存的拖拽位置
  restoreSavedPosition() {
    try {
      const saved = localStorage.getItem('btf_widget_position');
      if (saved) {
        const { left, top } = JSON.parse(saved);
        if (typeof left === 'number' && typeof top === 'number') {
          const maxLeft = window.innerWidth - 80;
          const maxTop = window.innerHeight - 50;
          const safeLeft = Math.max(10, Math.min(maxLeft, left));
          const safeTop = Math.max(10, Math.min(maxTop, top));

          this.container.style.left = `${safeLeft}px`;
          this.container.style.top = `${safeTop}px`;
          this.container.style.right = 'auto';
          this.container.style.bottom = 'auto';
          this.container.style.transform = 'none';
        }
      }
    } catch (e) {}
  }

  // 拖拽支持 (支持拖拽卡片或小胶囊至屏幕任意位置并持久化保存)
  setupDraggable() {
    const root = this.container;
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    const onMouseDown = (e) => {
      if (e.target.closest('button, kbd, input, .btf-pomodoro-pill')) return;

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
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // 持久化保存位置
      try {
        const rect = root.getBoundingClientRect();
        localStorage.setItem('btf_widget_position', JSON.stringify({ left: rect.left, top: rect.top }));
      } catch (e) {}
    };

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
    if (this.isCollapsed) {
      this.setCollapsed(false);
    }

    const banner = document.getElementById('btf-ping-banner');
    if (banner) {
      banner.classList.add('btf-ping-visible');
      this.isPingActive = true;
    }

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
    if (this.pomodoro) {
      this.pomodoro.destroy();
    }
    clearTimeout(this.toastTimer);
    clearTimeout(this.autoDismissTimer);
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

window.FocusCapsule = FocusCapsule;
