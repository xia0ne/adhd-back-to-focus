/**
 * 回神 · Back to Focus
 * Apple 风格灵动药丸胶囊 (HUD) & 注意力定时唤醒
 */

class FocusCapsule {
  constructor({ onSnapback, onContinue, onToggleTts }) {
    this.container = null;
    this.timer = null;
    this.pingIntervalMs = 2 * 60 * 1000; // 默认 2 分钟
    this.onSnapback = onSnapback;
    this.onContinue = onContinue;
    this.onToggleTts = onToggleTts;
    this.isExpanded = false;

    this.render();
    this.startPingTimer();
  }

  render() {
    if (document.getElementById('btf-capsule-root')) return;

    const root = document.createElement('div');
    root.id = 'btf-capsule-root';
    root.className = 'btf-capsule-root';

    root.innerHTML = `
      <div class="btf-capsule" id="btf-capsule">
        <div class="btf-capsule-normal" id="btf-capsule-normal">
          <div class="btf-capsule-pill btf-capsule-brand">回神</div>
          <div class="btf-capsule-item" id="btf-capsule-pos">
            <span class="btf-capsule-label">段落</span>
            <span class="btf-capsule-val" id="btf-pos-val">01 / 01</span>
          </div>
          <div class="btf-capsule-divider"></div>
          <div class="btf-capsule-item" id="btf-capsule-chk">
            <span class="btf-capsule-label">检查点</span>
            <span class="btf-capsule-val" id="btf-chk-val">未设定</span>
          </div>
          <div class="btf-capsule-divider"></div>
          <div class="btf-capsule-item btf-capsule-action" id="btf-capsule-tts-btn" title="点击或按 S 朗读">
            <span class="btf-capsule-icon">🔊</span>
            <span class="btf-capsule-val" id="btf-tts-rate">1.2x</span>
          </div>
        </div>

        <div class="btf-capsule-ping" id="btf-capsule-ping">
          <span class="btf-ping-pulse"></span>
          <span class="btf-ping-text">思维跟上了吗？</span>
          <div class="btf-ping-actions">
            <button class="btf-ping-btn btf-ping-continue" id="btf-btn-continue">
              <kbd class="btf-kbd">Space</kbd> 专注中
            </button>
            <button class="btf-ping-btn btf-ping-snapback" id="btf-btn-snapback">
              <kbd class="btf-kbd">R</kbd> 回神
            </button>
          </div>
        </div>

        <div class="btf-capsule-toast" id="btf-capsule-toast"></div>
      </div>
    `;

    document.body.appendChild(root);
    this.container = root;

    // 事件绑定
    root.querySelector('#btf-btn-continue').addEventListener('click', (e) => {
      e.stopPropagation();
      this.collapsePing();
      if (this.onContinue) this.onContinue();
    });

    root.querySelector('#btf-btn-snapback').addEventListener('click', (e) => {
      e.stopPropagation();
      this.collapsePing();
      if (this.onSnapback) this.onSnapback();
    });

    root.querySelector('#btf-capsule-tts-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onToggleTts) this.onToggleTts();
    });
  }

  updateProgress(current, total, checkpoint) {
    const posVal = document.getElementById('btf-pos-val');
    const chkVal = document.getElementById('btf-chk-val');

    if (posVal) {
      posVal.textContent = `${String(current + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    }

    if (chkVal) {
      if (checkpoint !== null && checkpoint !== undefined) {
        chkVal.innerHTML = `<span class="btf-accent-amber">⚓ ${String(checkpoint + 1).padStart(2, '0')} 段</span>`;
      } else {
        chkVal.textContent = '按 C 设定';
      }
    }
  }

  updateTtsRate(rate, isPlaying) {
    const rateVal = document.getElementById('btf-tts-rate');
    const ttsBtn = document.getElementById('btf-capsule-tts-btn');
    if (rateVal) {
      rateVal.textContent = `${rate}x`;
    }
    if (ttsBtn) {
      ttsBtn.classList.toggle('btf-tts-playing', isPlaying);
    }
  }

  showToast(message, duration = 1500) {
    const toast = document.getElementById('btf-capsule-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('btf-toast-show');

    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('btf-toast-show');
    }, duration);
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
    this.collapsePing();
    this.startPingTimer();
  }

  triggerMindfulnessPing() {
    const capsule = document.getElementById('btf-capsule');
    if (!capsule) return;

    this.isExpanded = true;
    capsule.classList.add('btf-capsule-expanded');

    // 自动在 9 秒后优雅退回
    clearTimeout(this.autoCollapseTimer);
    this.autoCollapseTimer = setTimeout(() => {
      this.collapsePing();
    }, 9000);
  }

  collapsePing() {
    const capsule = document.getElementById('btf-capsule');
    if (capsule) {
      capsule.classList.remove('btf-capsule-expanded');
    }
    this.isExpanded = false;
    this.startPingTimer();
  }

  destroy() {
    this.stopPingTimer();
    clearTimeout(this.toastTimer);
    clearTimeout(this.autoCollapseTimer);
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

window.FocusCapsule = FocusCapsule;
