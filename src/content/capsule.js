/**
 * 回神 · Back to Focus
 * Apple 风格可折叠可拖拽悬浮控制卡片 (Floating Widget)
 * 集成：微感知耗时锚点、ADHD 番茄冲刺钟、拖拽记忆与从头重置
 */

class FocusCapsule {
  constructor({ onNext, onPrev, onCheckpoint, onSnapback, onClose, onRestart }) {
    this.container = null;
    this.onNext = onNext;
    this.onPrev = onPrev;
    this.onCheckpoint = onCheckpoint;
    this.onSnapback = onSnapback;
    this.onClose = onClose;
    this.onRestart = onRestart;

    this.isCollapsed = false;
    this.awaitingBreak = false;
    this.currentData = {
      current: 0,
      total: 1,
      checkpoint: null,
      sustainedIndex: null,
      checkpointMarkedAt: null,
      snapbackIndex: 0
    };

    // 初始化 ADHD 专注冲刺番茄钟。控件只留在折叠胶囊上。
    this.pomodoro = new window.PomodoroTimer({
      onTick: (data) => this.updatePomodoroUI(data),
      onFocusComplete: () => this.handlePomodoroFocusComplete(),
      onBreakComplete: () => this.handlePomodoroBreakComplete()
    });

    this.render();
    this.restoreSavedPosition();
    this.setupDraggable();
    this.ageTimer = setInterval(() => this.renderMeta(), 30000);
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
        <span class="btf-mini-pomo" id="btf-mini-pomo" title="单击开始或暂停，双击切换 10 / 15 / 25 分钟">⏳ 15:00</span>
        <span class="btf-mini-expand">⤢</span>
      </div>

      <!-- 展开态：Apple 风格悬浮控制卡片 -->
      <div class="btf-card" id="btf-card">
        <!-- 头部 (拖拽把手与折叠控制) -->
        <div class="btf-card-header" id="btf-card-drag-handle">
          <div class="btf-card-title">
            <span class="btf-logo-dot"></span>
            <span>回神</span>
          </div>
          
          <div class="btf-header-actions">
            <button class="btf-icon-btn" id="btf-btn-settings" title="偏好设置">⚙</button>
            <button class="btf-icon-btn" id="btf-btn-minimize" title="折叠为小胶囊">─</button>
            <button class="btf-icon-btn" id="btf-btn-close" title="退出聚焦模式">✕</button>
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

        <div class="btf-meta-block">
          <div class="btf-meta-line" id="btf-sustained-line">上次停下 · 还没有</div>
          <div class="btf-meta-line" id="btf-check-age">距上次签收 · 还没有</div>
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

        <!-- 卡片快捷偏好设置浮层 -->
        <div class="btf-card-settings" id="btf-card-settings" style="display: none;">
          <div class="btf-settings-header">
            <span class="btf-settings-title">偏好设置</span>
            <button class="btf-icon-btn" id="btf-btn-close-settings" title="关闭设置">✕</button>
          </div>
          <div class="btf-settings-list">
            <label class="btf-settings-item">
              <div class="btf-settings-label-group">
                <span class="btf-settings-label">双击段落开启聚焦</span>
                <span class="btf-settings-hint">关闭可划词复制选词</span>
              </div>
              <input type="checkbox" id="btf-toggle-dblclick" class="btf-mini-switch">
            </label>
            <label class="btf-settings-item">
              <div class="btf-settings-label-group">
                <span class="btf-settings-label">视线平滑吸附居中</span>
                <span class="btf-settings-hint">换段平滑滚动至视线舒适区</span>
              </div>
              <input type="checkbox" id="btf-toggle-autoscroll" class="btf-mini-switch">
            </label>
            <label class="btf-settings-item">
              <div class="btf-settings-label-group">
                <span class="btf-settings-label">保留思维飘逸痕迹</span>
                <span class="btf-settings-hint">回神时以琥珀线提示漏读段</span>
              </div>
              <input type="checkbox" id="btf-toggle-drift" class="btf-mini-switch">
            </label>
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

    // 从头重置按钮
    root.querySelector('#btf-btn-restart').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onRestart) this.onRestart();
    });

    // 快捷偏好设置浮层控制
    const settingsPanel = root.querySelector('#btf-card-settings');
    const toggleDblClick = root.querySelector('#btf-toggle-dblclick');
    const toggleAutoScroll = root.querySelector('#btf-toggle-autoscroll');
    const toggleDrift = root.querySelector('#btf-toggle-drift');

    root.querySelector('#btf-btn-settings').addEventListener('click', async (e) => {
      e.stopPropagation();
      const isVisible = settingsPanel.style.display !== 'none';
      if (!isVisible) {
        const data = await chrome.storage.local.get(['settings']);
        const s = data.settings || {};
        toggleDblClick.checked = !!s.enableDblClick;
        toggleAutoScroll.checked = s.autoScroll !== false;
        toggleDrift.checked = s.keepDriftMarks !== false;
        settingsPanel.style.display = 'flex';
      } else {
        settingsPanel.style.display = 'none';
      }
    });

    root.querySelector('#btf-btn-close-settings').addEventListener('click', (e) => {
      e.stopPropagation();
      settingsPanel.style.display = 'none';
    });

    const onSettingChange = async () => {
      const data = await chrome.storage.local.get(['settings']);
      const s = data.settings || {};
      s.enableDblClick = toggleDblClick.checked;
      s.autoScroll = toggleAutoScroll.checked;
      s.keepDriftMarks = toggleDrift.checked;
      await chrome.storage.local.set({ settings: s });
      this.showToast('偏好设置已更新', 1200);
    };

    toggleDblClick.addEventListener('change', onSettingChange);
    toggleAutoScroll.addEventListener('change', onSettingChange);
    toggleDrift.addEventListener('change', onSettingChange);

    // 番茄钟只挂在折叠胶囊的计时上：单击启停，双击换挡
    const miniPomo = root.querySelector('#btf-mini-pomo');
    let clickTimeout = null;
    miniPomo.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.pomodoro.state === 'BREAK') return;
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
        this.awaitingBreak = false;
        this.pomodoro.cycleDuration();
        this.showToast(`冲刺时长: ${this.pomodoro.focusMinutes} 分钟`, 1000);
      } else {
        clickTimeout = setTimeout(() => {
          clickTimeout = null;
          if (this.awaitingBreak) {
            this.awaitingBreak = false;
            this.pomodoro.startBreak(3);
            this.showToast('开启 3 分钟放松休息 ☕', 1500);
            return;
          }
          this.pomodoro.toggle();
          const running = this.pomodoro.state === 'RUNNING';
          this.showToast(running ? '专注计时已开启' : '计时已暂停', 1000);
        }, 220);
      }
    });
  }

  updatePomodoroUI({ formatted, state }) {
    const miniPomo = document.getElementById('btf-mini-pomo');
    if (!miniPomo) return;

    if (this.awaitingBreak) {
      miniPomo.textContent = '☕ 休息';
      miniPomo.title = '单击开始 3 分钟休息';
      miniPomo.classList.add('btf-pomo-done');
      miniPomo.classList.remove('btf-pomo-running', 'btf-pomo-break');
      return;
    }

    const icon = state === 'BREAK' ? '☕' : '⏳';
    miniPomo.textContent = `${icon} ${formatted}`;
    miniPomo.title = state === 'BREAK'
      ? '休息中'
      : '单击开始或暂停，双击切换 10 / 15 / 25 分钟';
    miniPomo.classList.toggle('btf-pomo-running', state === 'RUNNING');
    miniPomo.classList.toggle('btf-pomo-break', state === 'BREAK');
    miniPomo.classList.remove('btf-pomo-done');
  }

  handlePomodoroFocusComplete() {
    this.awaitingBreak = true;
    this.updatePomodoroUI({ formatted: '00:00', state: 'IDLE' });
    chrome.runtime.sendMessage({
      action: 'RECORD_EVENT',
      payload: {
        type: 'SPRINT_COMPLETE',
        minutes: this.pomodoro.focusMinutes
      }
    }).catch(() => {});
    this.showToast('冲刺达成！已计入统计。点胶囊上的计时休息 3 分钟', 2200);
  }

  handlePomodoroBreakComplete() {
    this.awaitingBreak = false;
    this.showToast('休息结束，可以继续读了 ✦', 2000);
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

  updateProgress(current, total, checkpoint, activeBlock = null, extra = {}) {
    this.currentData.current = current;
    this.currentData.total = total;
    this.currentData.checkpoint = checkpoint;
    this.currentData.sustainedIndex = Object.prototype.hasOwnProperty.call(extra, 'sustainedIndex')
      ? extra.sustainedIndex
      : this.currentData.sustainedIndex;
    this.currentData.checkpointMarkedAt = Object.prototype.hasOwnProperty.call(extra, 'checkpointMarkedAt')
      ? extra.checkpointMarkedAt
      : this.currentData.checkpointMarkedAt;
    this.currentData.snapbackIndex = Object.prototype.hasOwnProperty.call(extra, 'snapbackIndex')
      ? extra.snapbackIndex
      : checkpoint;

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

    const snapbackIndex = this.currentData.snapbackIndex;
    if (snapbackText) {
      if (typeof snapbackIndex === 'number' && snapbackIndex < current) {
        snapbackText.textContent = `一键回神 (退 ${current - snapbackIndex} 段)`;
      } else {
        snapbackText.textContent = '一键回神';
      }
    }

    this.renderMeta();

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

  renderMeta() {
    const sustainedLine = document.getElementById('btf-sustained-line');
    const ageLine = document.getElementById('btf-check-age');
    const sustained = this.currentData.sustainedIndex;
    const markedAt = this.currentData.checkpoint === null || this.currentData.checkpoint === undefined
      ? null
      : this.currentData.checkpointMarkedAt;

    if (sustainedLine) {
      if (typeof sustained === 'number') {
        sustainedLine.textContent = sustained === this.currentData.current
          ? '上次停下 · 就在这段'
          : `上次停下 · 第 ${sustained + 1} 段`;
      } else {
        sustainedLine.textContent = '上次停下 · 还没有';
      }
    }

    if (ageLine) {
      ageLine.textContent = this.formatCheckpointAge(markedAt);
    }
  }

  formatCheckpointAge(timestamp) {
    if (!timestamp) return '距上次签收 · 还没有';
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 45) return '距上次签收 · 刚刚';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `距上次签收 · ${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const remain = minutes % 60;
    if (remain === 0) return `距上次签收 · ${hours} 小时`;
    return `距上次签收 · ${hours} 小时 ${remain} 分钟`;
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
      if (e.target.closest('button, kbd, input, #btf-mini-pomo')) return;

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

  destroy() {
    if (this.pomodoro) {
      this.pomodoro.destroy();
    }
    clearInterval(this.ageTimer);
    clearTimeout(this.toastTimer);
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

window.FocusCapsule = FocusCapsule;
