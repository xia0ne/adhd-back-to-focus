/**
 * 回神 · Back to Focus
 * AI 平台与通用网页结构适配器
 */

const AIAdapters = {
  // 检测当前是否为主流 AI 对话平台
  detectPlatform() {
    const host = window.location.hostname;
    if (host.includes('chatgpt.com') || host.includes('openai.com')) return 'chatgpt';
    if (host.includes('claude.ai')) return 'claude';
    if (host.includes('gemini.google.com')) return 'gemini';
    if (host.includes('deepseek.com')) return 'deepseek';
    if (host.includes('moonshot.cn') || host.includes('kimi.ai')) return 'kimi';
    if (host.includes('zhipuqingyan.cn') || host.includes('chatglm.cn')) return 'chatglm';
    return 'generic';
  },

  // 获取特定 AI 平台回答消息的容器
  getAIContainers(platform) {
    switch (platform) {
      case 'chatgpt':
        return document.querySelectorAll('[data-message-author-role="assistant"] .markdown, .agent-turn .markdown');
      
      case 'claude':
        return document.querySelectorAll('.font-claude-message, [data-is-streaming] .standard-markdown, .prose');
      
      case 'gemini':
        return document.querySelectorAll('message-content, .model-response-text, .response-container');
      
      case 'deepseek':
        return document.querySelectorAll('.ds-markdown, .chat-message-assistant .markdown');
      
      case 'kimi':
        return document.querySelectorAll('.chat-bubble-content, .kimi-markdown, .segment-content');
      
      default:
        return [];
    }
  },

  // 针对 DeepSeek / Claude 思维链 (Thinking Block) 预处理
  foldThinkingBlocks(rootElement) {
    if (!rootElement) return;

    // DeepSeek 思考过程折叠
    const thinkBlocks = rootElement.querySelectorAll('think, .ds-think, .thinking-container, .reasoning-content');
    thinkBlocks.forEach((block) => {
      if (block.dataset.btfProcessed) return;
      block.dataset.btfProcessed = 'true';
      block.classList.add('btf-thinking-block');
      
      // 创建极简 Apple 风格折叠控制柄
      const togglePill = document.createElement('div');
      togglePill.className = 'btf-thinking-pill';
      togglePill.innerHTML = '<span class="btf-icon">💭</span><span>深度思考过程 (已折叠, 点击展开)</span>';
      
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'btf-thinking-content btf-collapsed';
      
      while (block.firstChild) {
        contentWrapper.appendChild(block.firstChild);
      }
      
      togglePill.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = contentWrapper.classList.toggle('btf-collapsed');
        togglePill.querySelector('span:last-child').textContent = isCollapsed 
          ? '深度思考过程 (已折叠, 点击展开)' 
          : '深度思考过程 (已展开, 点击收起)';
      });
      
      block.appendChild(togglePill);
      block.appendChild(contentWrapper);
    });
  },

  // 提取有效阅读块（段落、列表单项、代码块整体、引用块）
  extractUnitsFromContainer(container) {
    if (!container) return [];

    const units = [];
    // 递归或层级遍历主要内容节点
    const candidates = container.querySelectorAll(
      'p, li, pre, blockquote, h1, h2, h3, h4, .katex-display'
    );

    candidates.forEach((el) => {
      // 过滤嵌套内部元素（例如 pre 内的 p，或者 ul 内的 pre）
      if (el.tagName === 'P' && el.closest('pre, li, blockquote')) {
        // 如果是在 li 内部但 li 已经是单位，则避免重复处理
        if (el.closest('li')) return;
      }
      if (el.closest('.btf-collapsed')) {
        // 折叠状态下的思考过程跳过
        return;
      }

      const text = el.innerText ? el.innerText.trim() : '';
      if (text.length < 2 && el.tagName !== 'PRE') return;

      units.push(el);
    });

    return units;
  }
};

window.AIAdapters = AIAdapters;
