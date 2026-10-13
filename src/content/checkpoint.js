/**
 * 回神 · Back to Focus
 * 理解检查点 (C) 与一键回神 (R) 状态机
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
