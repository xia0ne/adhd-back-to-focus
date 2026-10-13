/**
 * 回神 · Back to Focus
 * DOM 提取器与阅读单元索引器
 */

const DOMExtractor = {
  blocks: [],
  currentContainer: null,

  // 发现页面中最适合的阅读容器
  findMainContainer() {
    const platform = window.AIAdapters ? window.AIAdapters.detectPlatform() : 'generic';

    if (platform !== 'generic') {
      const aiContainers = window.AIAdapters.getAIContainers(platform);
      if (aiContainers && aiContainers.length > 0) {
        // 优先选中最新的一条 AI 回答
        return aiContainers[aiContainers.length - 1];
      }
    }

    // 通用网页文章容器启发式检测
    const articleSelectors = [
      'article',
      '[role="article"]',
      'main',
      '.post-content',
      '.article-content',
      '.entry-content',
      '#article-root',
      '.markdown-body',
      '.content-body',
      '.RichText' // 如知乎
    ];

    for (const selector of articleSelectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText && el.innerText.trim().length > 200) {
        return el;
      }
    }

    // 终极备选：body
    return document.body;
  },

  // 扫描并建立索引
  scanAndIndex(container) {
    this.currentContainer = container || this.findMainContainer();
    if (!this.currentContainer) {
      this.blocks = [];
      return [];
    }

    // 如果是 AI 平台，先处理思维链折叠
    if (window.AIAdapters) {
      window.AIAdapters.foldThinkingBlocks(this.currentContainer);
    }

    let elements = [];
    if (window.AIAdapters && window.AIAdapters.detectPlatform() !== 'generic') {
      elements = window.AIAdapters.extractUnitsFromContainer(this.currentContainer);
    } else {
      // 通用文章提取
      const candidates = this.currentContainer.querySelectorAll('p, pre, blockquote, h1, h2, h3, h4, li');
      candidates.forEach((el) => {
        // 过滤不可见元素或过小元素
        if (el.offsetParent === null && el.tagName !== 'BODY') return;
        if (el.closest('footer, nav, aside, .comments, #comments')) return;
        if (el.tagName === 'P' && el.closest('pre, li, blockquote')) return;

        const text = el.innerText ? el.innerText.trim() : '';
        if (text.length < 2 && el.tagName !== 'PRE') return;

        elements.push(el);
      });
    }

    this.blocks = elements.map((el, index) => {
      el.dataset.btfIndex = index;
      let type = 'paragraph';
      if (el.tagName === 'PRE') type = 'code';
      else if (el.tagName === 'LI') type = 'list-item';
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
