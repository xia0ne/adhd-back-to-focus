/**
 * 回神 · Back to Focus
 * DOM 提取器与阅读单元索引器
 */

const DOMExtractor = {
  blocks: [],
  currentContainer: null,

  articleSelectors: [
    'article',
    '[role="article"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#article-root',
    '.markdown-body',
    '.content-body',
    '.RichText'
  ],

  findMainContainer() {
    const platform = window.AIAdapters ? window.AIAdapters.detectPlatform() : 'generic';

    if (platform !== 'generic') {
      const aiContainers = window.AIAdapters.getAIContainers(platform);
      if (aiContainers && aiContainers.length > 0) {
        return aiContainers[aiContainers.length - 1];
      }
    }

    for (const selector of this.articleSelectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText && el.innerText.trim().length > 200) {
        return el;
      }
    }

    return document.body;
  },

  // 双击或续读时，取用户点中的那一条消息 / 那篇文章，而不是最新一条回复
  findReadingContainer(hintEl) {
    if (!hintEl || hintEl.nodeType !== 1) return null;

    const platform = window.AIAdapters ? window.AIAdapters.detectPlatform() : 'generic';
    if (platform !== 'generic' && window.AIAdapters) {
      const containers = window.AIAdapters.getAIContainers(platform);
      for (const container of containers) {
        if (container === hintEl || container.contains(hintEl)) return container;
      }
      const message = hintEl.closest(
        '[data-message-author-role="assistant"], .font-claude-message, message-content, .ds-markdown, .chat-message-assistant, .agent-turn, .response-container'
      );
      if (message && message !== document.body) return message;
    }

    for (const selector of this.articleSelectors) {
      const host = hintEl.closest(selector);
      if (host && host.innerText && host.innerText.trim().length > 200) return host;
    }
    return null;
  },

  // 同一条消息的进度键。优先用消息 id，避免流式输出把键改掉。
  containerScopeId(container) {
    if (!container || container === document.body) return '';
    const labeled = container.closest('[data-message-id]');
    if (labeled && labeled.dataset.messageId) return labeled.dataset.messageId;
    if (container.dataset && container.dataset.messageId) return container.dataset.messageId;

    const platform = window.AIAdapters ? window.AIAdapters.detectPlatform() : 'generic';
    if (platform === 'generic' || !window.AIAdapters) return '';
    const list = window.AIAdapters.getAIContainers(platform);
    const idx = Array.prototype.indexOf.call(list, container);
    const snap = (container.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    return `ai:${idx}:${snap}`;
  },

  collectElements(container) {
    if (!container) return [];

    let elements = [];
    if (window.AIAdapters && window.AIAdapters.detectPlatform() !== 'generic') {
      elements = window.AIAdapters.extractUnitsFromContainer(container);
    } else {
      const candidates = container.querySelectorAll('p, pre, blockquote, h1, h2, h3, h4, li, tr');
      candidates.forEach((el) => {
        if (el.offsetParent === null && el.tagName !== 'BODY') return;
        if (el.closest('footer, nav, aside, .comments, #comments')) return;
        if (el.tagName === 'P' && el.closest('pre, li, blockquote')) return;
        if ((el.tagName === 'P' || el.tagName === 'LI') && el.closest('tr, td, th, table')) return;

        const text = el.innerText ? el.innerText.trim() : '';
        if (text.length < 2 && el.tagName !== 'PRE' && el.tagName !== 'TR') return;
        elements.push(el);
      });
    }
    return elements;
  },

  clearMarks() {
    document.querySelectorAll('[data-btf-index]').forEach((el) => {
      el.removeAttribute('data-btf-index');
      el.classList.remove(
        'btf-active-block',
        'btf-adjacent-block',
        'btf-drift-mark',
        'btf-has-checkpoint',
        'btf-snapback-target',
        'btf-pulse-amber'
      );
    });
    document.querySelectorAll('.btf-checkpoint-badge').forEach((badge) => badge.remove());
  },

  commitBlocks(elements) {
    this.clearMarks();
    this.blocks = elements.map((el, index) => {
      el.dataset.btfIndex = String(index);
      let type = 'paragraph';
      if (el.tagName === 'PRE') type = 'code';
      else if (el.tagName === 'LI') type = 'list-item';
      else if (el.tagName === 'TR') type = 'table-row';
      else if (el.tagName.startsWith('H')) type = 'heading';
      else if (el.tagName === 'BLOCKQUOTE') type = 'quote';

      return {
        id: `btf-block-${index}`,
        index,
        element: el,
        type,
        text: el.innerText ? el.innerText.trim() : ''
      };
    });
    return this.blocks;
  },

  scanAndIndex(container) {
    this.currentContainer = container || this.findMainContainer();
    if (!this.currentContainer) {
      this.blocks = [];
      return [];
    }

    if (window.AIAdapters) {
      window.AIAdapters.foldThinkingBlocks(this.currentContainer);
    }

    return this.commitBlocks(this.collectElements(this.currentContainer));
  },

  getBlock(index) {
    if (index >= 0 && index < this.blocks.length) {
      return this.blocks[index];
    }
    return null;
  },

  getTotalCount() {
    return this.blocks.length;
  }
};

window.DOMExtractor = DOMExtractor;
