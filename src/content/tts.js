/**
 * 回神 · Back to Focus
 * 双感官语音辅助阅读 (Web Speech API)
 */

class TTSEngine {
  constructor() {
    this.rate = 1.2; // 默认适合 ADHD 的轻快语速
    this.isPlaying = false;
    this.currentText = '';
    this.utterance = null;
    this.voice = null;

    this.initVoice();
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => this.initVoice();
    }
  }

  initVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    // 优先匹配当前语言的高质量自然语音 (如 Tingting / Samantha)
    const lang = document.documentElement.lang || 'zh-CN';
    const isChinese = lang.toLowerCase().startsWith('zh');

    this.voice = voices.find(v => isChinese ? v.lang.includes('zh') : v.lang.includes('en')) || voices[0];
  }

  speak(text, onEnd) {
    if (!('speechSynthesis' in window) || !text) return;

    this.stop();
    this.currentText = text;
    this.isPlaying = true;

    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.rate = this.rate;
    if (this.voice) {
      this.utterance.voice = this.voice;
    }

    this.utterance.onend = () => {
      this.isPlaying = false;
      if (onEnd) onEnd();
    };

    this.utterance.onerror = () => {
      this.isPlaying = false;
    };

    window.speechSynthesis.speak(this.utterance);
  }

  stop() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isPlaying = false;
  }

  toggle(text, onEnd) {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.speak(text, onEnd);
      return true;
    }
  }

  changeRate(delta) {
    this.rate = Math.min(2.5, Math.max(0.8, Math.round((this.rate + delta) * 10) / 10));
    return this.rate;
  }
}

window.TTSEngine = TTSEngine;
