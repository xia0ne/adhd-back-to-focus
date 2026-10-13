/**
 * 回神 · Back to Focus
 * 理解检查点 (C)、一键回神 (R) 与跨会话阅读记忆状态机
 */

class CheckpointManager {
  constructor() {
    this.currentIndex = 0;
    this.checkpointIndex = null;
    this.checkpointMarkedAt = null;
    this.sustainedIndex = null; // 最近一次停留满 8 秒的段落；没有停过就是 null
    this.lastMoveTimestamp = Date.now();
    this.scopeContainer = null;
    this.scopeId = '';
  }

  reset() {
    this.currentIndex = 0;
    this.checkpointIndex = null;
    this.checkpointMarkedAt = null;
    this.sustainedIndex = null;
    this.lastMoveTimestamp = Date.now();
  }

  // now 可注入，便于确认「满 8 秒才记为停下」
  setCurrentIndex(index, now = Date.now()) {
    if (now - this.lastMoveTimestamp >= 8000) {
      this.sustainedIndex = this.currentIndex;
    }
    this.currentIndex = index;
    this.lastMoveTimestamp = now;
  }

  // 重扫时只搬移序号，不把流式刷新当成一次翻段
  holdIndex(index) {
    this.currentIndex = index;
  }

  // 对整段地址做哈希。截断前缀会让同一站点下的不同对话共用一条进度。
  hashString(str) {
    let fnv = 2166136261;
    let djb = 5381;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      fnv ^= code;
      fnv = Math.imul(fnv, 16777619);
      djb = Math.imul(djb, 33) ^ code;
    }
    const left = (fnv >>> 0).toString(16).padStart(8, '0');
    const right = (djb >>> 0).toString(16).padStart(8, '0');
    return left + right;
  }

  getStorageKey() {
    try {
      const url = new URL(window.location.href);
      ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'source'].forEach(p => url.searchParams.delete(p));
      const cleanPath = url.origin + url.pathname + url.search;
      const scope = this.scopeId || '';
      return `btf_progress_${this.hashString(cleanPath + '|' + scope)}`;
    } catch (e) {
      const path = window.location && window.location.pathname ? window.location.pathname : 'page';
      return `btf_progress_${this.hashString(path + '|' + (this.scopeId || ''))}`;
    }
  }

  saveProgress(totalCount) {
    try {
      const key = this.getStorageKey();
      const payload = {
        currentIndex: this.currentIndex,
        checkpointIndex: this.checkpointIndex,
        checkpointMarkedAt: this.checkpointMarkedAt,
        sustainedIndex: this.sustainedIndex,
        total: totalCount || 0,
        timestamp: Date.now(),
        url: window.location.href
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {}
  }

  loadSavedProgress() {
    try {
      const key = this.getStorageKey();
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  clearSavedProgress() {
    try {
      const key = this.getStorageKey();
      localStorage.removeItem(key);
    } catch (e) {}
  }

  markCheckpoint(now = Date.now()) {
    this.checkpointIndex = this.currentIndex;
    this.checkpointMarkedAt = now;

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

  peekSnapbackTarget() {
    if (this.checkpointIndex !== null && this.checkpointIndex !== undefined) {
      return this.checkpointIndex;
    }
    if (typeof this.sustainedIndex === 'number' && this.sustainedIndex < this.currentIndex) {
      return this.sustainedIndex;
    }
    return Math.max(0, this.currentIndex - 3);
  }

  calculateSnapbackTarget() {
    const hasCheckpoint = this.checkpointIndex !== null && this.checkpointIndex !== undefined;
    const targetIndex = this.peekSnapbackTarget();
    const fallback = !hasCheckpoint;
    const driftDelta = Math.max(0, this.currentIndex - targetIndex);

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

  getSustainedIndex() {
    return this.sustainedIndex;
  }

  getCurrentIndex() {
    return this.currentIndex;
  }
}

window.CheckpointManager = CheckpointManager;
