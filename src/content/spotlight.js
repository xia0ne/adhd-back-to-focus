/**
 * 回神 · Back to Focus
 * Apple 风格聚光灯与视线平滑吸附渲染器
 */

function pageLooksDark() {
  const root = document.documentElement;
  if (root.classList.contains('dark') || root.classList.contains('theme-dark')) return true;
  if (root.classList.contains('light') || root.classList.contains('theme-light')) return false;
  const theme = (root.dataset.theme || root.dataset.colorMode || root.getAttribute('data-color-scheme') || '').toLowerCase();
  if (theme === 'dark') return true;
  if (theme === 'light') return false;

  const targets = [document.body, root];
  for (const el of targets) {
    const color = getComputedStyle(el).backgroundColor || '';
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) continue;
    if (match[4] !== undefined && Number(match[4]) === 0) continue;
    const luminance = (0.2126 * Number(match[1]) + 0.7152 * Number(match[2]) + 0.0722 * Number(match[3])) / 255;
    return luminance < 0.45;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

class SpotlightRenderer {
  constructor() {
    this.currentElement = null;
    this.adjacentElements = [];
    this.driftElements = new Set();
    this.keepDriftMarks = true;
  }

  init() {
    document.body.classList.add('btf-focus-enabled');
    this.syncTheme();
  }

  syncTheme() {
    document.body.classList.toggle('btf-dark', pageLooksDark());
  }

  focus(block, totalBlocks, options = {}) {
    if (!block || !block.element) return;
    const shouldScroll = options.scroll !== false;

    this.clearFocusStyles();

    const targetEl = block.element;
    this.currentElement = targetEl;
    targetEl.classList.add('btf-active-block');
    this.releaseDrift(targetEl);

    if (block.index > 0 && totalBlocks[block.index - 1]) {
      const prevEl = totalBlocks[block.index - 1].element;
      prevEl.classList.add('btf-adjacent-block');
      this.adjacentElements.push(prevEl);
    }
    if (block.index < totalBlocks.length - 1 && totalBlocks[block.index + 1]) {
      const nextEl = totalBlocks[block.index + 1].element;
      nextEl.classList.add('btf-adjacent-block');
      this.adjacentElements.push(nextEl);
    }

    if (shouldScroll) this.smoothScrollToComfortZone(targetEl);
  }

  // 阅读视口里偏上 32% 的位置。只跟随足够高的滚动容器，避免把代码块内部滚动区当成页面。
  findScrollParent(element) {
    let parent = element.parentElement;
    while (parent && parent !== document.documentElement) {
      const overflowY = getComputedStyle(parent).overflowY;
      const scrollable = (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
        && parent.scrollHeight > parent.clientHeight + 8;
      if (scrollable && parent.clientHeight > window.innerHeight * 0.4) return parent;
      parent = parent.parentElement;
    }
    return window;
  }

  smoothScrollToComfortZone(element) {
    if (!element) return;
    try {
      const scroller = this.findScrollParent(element);
      const rect = element.getBoundingClientRect();
      if (scroller === window) {
        const top = window.scrollY + rect.top - window.innerHeight * 0.32;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        return;
      }
      const scrollerRect = scroller.getBoundingClientRect();
      const top = scroller.scrollTop + (rect.top - scrollerRect.top) - scroller.clientHeight * 0.32;
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    } catch (e) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  markCheckpointBadge(element, options = {}) {
    if (!element) return;

    document.querySelectorAll('.btf-checkpoint-badge').forEach(b => b.remove());
    document.querySelectorAll('.btf-has-checkpoint').forEach(el => el.classList.remove('btf-has-checkpoint'));

    element.classList.add('btf-has-checkpoint');

    const badge = document.createElement('span');
    badge.className = 'btf-checkpoint-badge';
    badge.textContent = '⚓';
    badge.title = '理解检查点';

    if (element.tagName === 'TR') {
      const firstCell = element.querySelector('th, td');
      if (firstCell) firstCell.insertBefore(badge, firstCell.firstChild);
    } else {
      element.insertBefore(badge, element.firstChild);
    }

    if (options.pulse !== false) {
      element.classList.add('btf-pulse-amber');
      setTimeout(() => {
        element.classList.remove('btf-pulse-amber');
      }, 800);
    }
  }

  markDrift(elements) {
    if (!Array.isArray(elements)) return;
    elements.forEach((el) => {
      if (!el || el === this.currentElement) return;
      this.driftElements.add(el);
      el.classList.add('btf-drift-mark');
    });
  }

  releaseDrift(element) {
    if (!element) return;
    element.classList.remove('btf-drift-mark');
    this.driftElements.delete(element);
  }

  reapplyDrift(blocks) {
    const alive = new Set();
    const elements = new Set((blocks || []).map(block => block.element));
    this.driftElements.forEach((el) => {
      if (elements.has(el)) {
        el.classList.add('btf-drift-mark');
        alive.add(el);
      }
    });
    this.driftElements = alive;
  }

  clearAllDrift() {
    this.driftElements.forEach((el) => el.classList.remove('btf-drift-mark'));
    this.driftElements = new Set();
  }

  triggerSnapbackEffect(toElement, skippedElements = []) {
    if (toElement) {
      toElement.classList.add('btf-snapback-target');
      setTimeout(() => {
        toElement.classList.remove('btf-snapback-target');
      }, 1200);
    }
    if (this.keepDriftMarks !== false) {
      this.markDrift(skippedElements);
    }
  }

  clearFocusStyles() {
    if (this.currentElement) {
      this.currentElement.classList.remove('btf-active-block');
      this.currentElement = null;
    }
    this.adjacentElements.forEach(el => el.classList.remove('btf-adjacent-block'));
    this.adjacentElements = [];
  }

  destroy() {
    this.clearFocusStyles();
    this.clearAllDrift();
    document.querySelectorAll('.btf-checkpoint-badge').forEach(b => b.remove());
    document.querySelectorAll('.btf-has-checkpoint').forEach(el => el.classList.remove('btf-has-checkpoint'));
    document.body.classList.remove('btf-focus-enabled', 'btf-dark');
  }
}

window.SpotlightRenderer = SpotlightRenderer;
