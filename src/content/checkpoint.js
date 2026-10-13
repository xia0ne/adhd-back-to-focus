/**
 * 回神 · Back to Focus
 * 理解检查点 (C)、一键回神 (R) 与跨会话阅读记忆状态机
 */

class CheckpointManager {
  constructor() {
    this.currentIndex = 0;
    this.checkpointIndex = null;
    this.sustainedIndex = 0; // 最近一次慢速有效阅读段落（保底）
    this.lastMoveTimestamp = Date.now();
  }

  reset() {
    this.currentIndex = 0;
    this.checkpointIndex = null;
    this.sustainedIndex = 0;
    this.lastMoveTimestamp = Date.now();
  }

  setCurrentIndex(index) {
    const now = Date.now();
    // 如果在上一段停留超过 8 秒，记录为有效慢速阅读锚点
    if (now - this.lastMoveTimestamp >= 8000) {
      this.sustainedIndex = this.currentIndex;
    }
    this.currentIndex = index;
    this.lastMoveTimestamp = now;
  }

  // 格式化当前页面存储唯一标识 (忽略 utm 参数等干扰)
  getStorageKey() {
    try {
      const url = new URL(window.location.href);
      // 清除无意义查询参数
      ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'source'].forEach(p => url.searchParams.delete(p));
      const cleanPath = (url.origin + url.pathname + url.search).slice(0, 160);
      return `btf_progress_${btoa(unescape(encodeURIComponent(cleanPath))).slice(0, 32)}`;
    } catch (e) {
      return `btf_progress_${window.location.pathname.slice(0, 32)}`;
    }
  }

  // 保存当前阅读进度与检查点 (记忆模式)
  saveProgress(totalCount) {
    try {
      const key = this.getStorageKey();
      const payload = {
        currentIndex: this.currentIndex,
        checkpointIndex: this.checkpointIndex,
        total: totalCount || 0,
        timestamp: Date.now(),
        url: window.location.href
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {}
  }

  // 读取上次退出的阅读进度
  loadSavedProgress() {
    try {
      const key = this.getStorageKey();
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // 7 天之内的进度有效
      if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  // 清除当前页面记忆（支持用户主动从头开始）
  clearSavedProgress() {
    try {
      const key = this.getStorageKey();
      localStorage.removeItem(key);
    } catch (e) {}
  }

  // 按 C 标记检查点
  markCheckpoint() {
    this.checkpointIndex = this.currentIndex;
    
    // 上报事件给 background 用于本地元认知统计
    chrome.runtime.sendMessage({
      action: 'RECORD_EVENT',
      payload: {
        type: 'CHECKPOINT',
        index: this.currentIndex
      }
    }).catch(() => {});

    return {
      index: this.currentIndex,
      success: true
    };
  }

  // 按 R 计算一键回神的目标段落
  calculateSnapbackTarget() {
    let targetIndex = 0;
    let fallback = false;

    if (this.checkpointIndex !== null) {
      targetIndex = this.checkpointIndex;
    } else if (this.sustainedIndex !== null && this.sustainedIndex < this.currentIndex) {
      targetIndex = this.sustainedIndex;
      fallback = true;
    } else {
      // 没有任何检查点时的兜底：回退 3 段
      targetIndex = Math.max(0, this.currentIndex - 3);
      fallback = true;
    }

    const driftDelta = Math.max(0, this.currentIndex - targetIndex);

    // 上报回神事件与飘逸段落数
    chrome.runtime.sendMessage({
      action: 'RECORD_EVENT',
      payload: {
        type: 'SNAPBACK',
        value: driftDelta,
        targetIndex
      }
    }).catch(() => {});

    return {
      targetIndex,
      driftDelta,
      fallback
    };
  }

  getCheckpoint() {
    return this.checkpointIndex;
  }

  getCurrentIndex() {
    return this.currentIndex;
  }
}

window.CheckpointManager = CheckpointManager;
