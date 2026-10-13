/**
 * 回神 · Back to Focus
 * ADHD 专注冲刺番茄钟引擎 (Micro-Pomodoro Sprint Engine)
 */

class PomodoroTimer {
  constructor({ onTick, onFocusComplete, onBreakComplete }) {
    this.durations = [15, 10, 25]; // 默认推荐 15 分钟微冲刺，降低 ADHD 启动阻力
    this.durationIndex = 0;
    this.focusMinutes = this.durations[this.durationIndex];
    this.breakMinutes = 3; // 短暂 3 分钟神经休息

    this.state = 'IDLE'; // 'IDLE' | 'RUNNING' | 'PAUSED' | 'BREAK'
    this.remainingSeconds = this.focusMinutes * 60;
    this.endTime = null;
    this.timer = null;

    this.onTick = onTick;
    this.onFocusComplete = onFocusComplete;
    this.onBreakComplete = onBreakComplete;
  }

  // 格式化输出 mm:ss
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // 切换起止 (Start / Pause)
  toggle() {
    if (this.state === 'IDLE' || this.state === 'PAUSED') {
      this.start();
    } else if (this.state === 'RUNNING') {
      this.pause();
    }
  }

  start() {
    this.state = 'RUNNING';
    this.endTime = Date.now() + this.remainingSeconds * 1000;
    this.clearInterval();

    this.timer = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.round((this.endTime - now) / 1000));
      this.remainingSeconds = diff;

      if (this.onTick) {
        this.onTick({
          formatted: this.formatTime(this.remainingSeconds),
          remainingSeconds: this.remainingSeconds,
          state: this.state
        });
      }

      if (this.remainingSeconds <= 0) {
        this.clearInterval();
        this.state = 'IDLE';
        if (this.onFocusComplete) this.onFocusComplete();
      }
    }, 1000);

    if (this.onTick) {
      this.onTick({
        formatted: this.formatTime(this.remainingSeconds),
        remainingSeconds: this.remainingSeconds,
        state: this.state
      });
    }
  }

  pause() {
    if (this.state !== 'RUNNING') return;
    this.state = 'PAUSED';
    this.clearInterval();
    if (this.onTick) {
      this.onTick({
        formatted: this.formatTime(this.remainingSeconds),
        remainingSeconds: this.remainingSeconds,
        state: this.state
      });
    }
  }

  // 切换冲刺时长档位 (15m -> 10m -> 25m)
  cycleDuration() {
    if (this.state === 'RUNNING') return;
    this.durationIndex = (this.durationIndex + 1) % this.durations.length;
    this.focusMinutes = this.durations[this.durationIndex];
    this.remainingSeconds = this.focusMinutes * 60;
    this.state = 'IDLE';

    if (this.onTick) {
      this.onTick({
        formatted: this.formatTime(this.remainingSeconds),
        remainingSeconds: this.remainingSeconds,
        state: this.state
      });
    }
  }

  // 开启休息模式
  startBreak(minutes = 3) {
    this.state = 'BREAK';
    this.breakMinutes = minutes;
    this.remainingSeconds = minutes * 60;
    this.endTime = Date.now() + this.remainingSeconds * 1000;
    this.clearInterval();

    this.timer = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.round((this.endTime - now) / 1000));
      this.remainingSeconds = diff;

      if (this.onTick) {
        this.onTick({
          formatted: this.formatTime(this.remainingSeconds),
          remainingSeconds: this.remainingSeconds,
          state: this.state
        });
      }

      if (this.remainingSeconds <= 0) {
        this.clearInterval();
        this.reset();
        if (this.onBreakComplete) this.onBreakComplete();
      }
    }, 1000);
  }

  reset() {
    this.clearInterval();
    this.state = 'IDLE';
    this.remainingSeconds = this.focusMinutes * 60;
    if (this.onTick) {
      this.onTick({
        formatted: this.formatTime(this.remainingSeconds),
        remainingSeconds: this.remainingSeconds,
        state: this.state
      });
    }
  }

  clearInterval() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  destroy() {
    this.clearInterval();
  }
}

window.PomodoroTimer = PomodoroTimer;
