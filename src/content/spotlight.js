/**
 * 回神 · Back to Focus
 * Apple 风格聚光灯与视线平滑吸附渲染器
 */

class SpotlightRenderer {
  constructor() {
    this.currentElement = null;
    this.adjacentElements = [];
    this.overlayElement = null;
  }

  init() {
    document.body.classList.add('btf-focus-enabled');
  }

  // 聚焦到指定段落
  focus(block, totalBlocks) {
    if (!block || !block.element) return;

    // 清理之前的焦点状态
    this.clearFocusStyles();

    const targetEl = block.element;
    this.currentElement = targetEl;

    // 标记当前焦点
    targetEl.classList.add('btf-active-block');

    // 标记前后各一段为邻近半聚焦（保留上下文）
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

    // 平滑吸附至屏幕人体工学舒适区 (偏上 32% 视口位置)
    this.smoothScrollToComfortZone(targetEl);
  }

  smoothScrollToComfortZone(element) {
    if (!element) return;
    try {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    } catch (e) {
      element.scrollIntoView(true);
    }
  }

  // 为段落打上理解检查点 (C)
  markCheckpointBadge(element) {
    if (!element) return;

    // 先清除其他段落的检查点高亮（保持唯一锚点）
    document.querySelectorAll('.btf-checkpoint-badge').forEach(b => b.remove());
    document.querySelectorAll('.btf-has-checkpoint').forEach(el => el.classList.remove('btf-has-checkpoint'));

    element.classList.add('btf-has-checkpoint');

    const badge = document.createElement('span');
    badge.className = 'btf-checkpoint-badge';
    badge.innerHTML = '⚓';
    badge.title = '理解检查点';

    // 插入到首部 (如果是表格行，插入到首个单元格内避免破坏表格DOM结构)
    if (element.tagName === 'TR') {
      const firstCell = element.querySelector('th, td');
      if (firstCell) {
        firstCell.insertBefore(badge, firstCell.firstChild);
      }
    } else {
      element.insertBefore(badge, element.firstChild);
    }

    // 触发轻柔微光涟漪动效
    element.classList.add('btf-pulse-amber');
    setTimeout(() => {
      element.classList.remove('btf-pulse-amber');
    }, 800);
  }

  // 一键回神 (R) 动效反馈与迷雾切断
  triggerSnapbackEffect(fromElement, toElement, skippedElements = []) {
    if (toElement) {
      toElement.classList.add('btf-snapback-target');
      setTimeout(() => {
        toElement.classList.remove('btf-snapback-target');
      }, 1200);
    }

    // 将刚才走神滑过的段落施加切断动效
    if (Array.isArray(skippedElements)) {
      skippedElements.forEach((el) => {
        if (!el) return;
        el.classList.add('btf-drift-fog');
        setTimeout(() => {
          el.classList.remove('btf-drift-fog');
        }, 1500);
      });
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
    document.querySelectorAll('.btf-checkpoint-badge').forEach(b => b.remove());
    document.querySelectorAll('.btf-has-checkpoint').forEach(el => el.classList.remove('btf-has-checkpoint'));
    document.body.classList.remove('btf-focus-enabled');
  }
}

window.SpotlightRenderer = SpotlightRenderer;
