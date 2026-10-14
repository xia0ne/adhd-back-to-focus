/**
 * 回神 · Back to Focus
 * Background Service Worker
 */

const DEFAULT_SETTINGS = {
  enableDblClick: false, // 核心设定：默认关闭双击段落聚焦，保证日常双击划词复制完全不受干扰
  autoScroll: true,      // 切换聚焦段落时平滑吸附居中
  keepDriftMarks: true,  // 回神时保留思维飘逸跳过段落的标记
  autoFoldThinking: true, // 自动折叠 AI 思考过程 (Claude/DeepSeek 等)
  dimLevel: 'standard'   // 聚焦淡化强度: 'soft' (40%) | 'standard' (22%) | 'deep' (8%)
};

const DEFAULT_STATS = {
  todaySnapbacks: 0,
  todayCheckpoints: 0,
  todayParagraphsRead: 0,
  totalSnapbacks: 0,
  totalCheckpoints: 0,
  totalDriftParagraphs: 0,
  totalParagraphsRead: 0,
  completedSprints: 0,
  totalFocusMinutes: 0,
  lastActiveDate: new Date().toISOString().slice(0, 10),
  dailyHistory: {}       // 每日专注历史: { 'YYYY-MM-DD': { paragraphs: 0, snapbacks: 0, checkpoints: 0 } }
};

// 初始化或合并默认配置与统计
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['settings', 'stats']);
  const mergedSettings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  // 若之前未设定过 enableDblClick，确保默认关闭以解除划词复制冲突
  if (data.settings && data.settings.enableDblClick === undefined) {
    mergedSettings.enableDblClick = false;
  }
  if (data.settings && data.settings.dimLevel === undefined) {
    mergedSettings.dimLevel = 'standard';
  }
  const mergedStats = { ...DEFAULT_STATS, ...(data.stats || {}) };
  if (!mergedStats.dailyHistory || typeof mergedStats.dailyHistory !== 'object') {
    mergedStats.dailyHistory = {};
  }
  await chrome.storage.local.set({ settings: mergedSettings, stats: mergedStats });
});

// 处理全局快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-focus-mode') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_FOCUS' }).catch(() => {
        // 页面可能未加载 content script（如 chrome:// 页面）
      });
    }
  }
});

// 监听内容脚本的消息与统计上报
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'RECORD_EVENT') {
    handleRecordEvent(message.payload);
    sendResponse({ status: 'ok' });
    return true;
  } else if (message.action === 'RESET_STATS') {
    const freshStats = {
      ...DEFAULT_STATS,
      lastActiveDate: new Date().toISOString().slice(0, 10),
      dailyHistory: {}
    };
    chrome.storage.local.set({ stats: freshStats }).then(() => {
      sendResponse({ status: 'ok', stats: freshStats });
    });
    return true;
  }
});

async function handleRecordEvent({ type, value, minutes }) {
  const data = await chrome.storage.local.get(['stats']);
  const stats = { ...DEFAULT_STATS, ...(data.stats || {}) };
  const today = new Date().toISOString().slice(0, 10);

  if (!stats.dailyHistory || typeof stats.dailyHistory !== 'object') {
    stats.dailyHistory = {};
  }
  if (!stats.dailyHistory[today]) {
    stats.dailyHistory[today] = { paragraphs: 0, snapbacks: 0, checkpoints: 0 };
  }

  // 跨天重置当日数据并修剪超 30 天的旧历史
  if (stats.lastActiveDate !== today) {
    stats.todaySnapbacks = 0;
    stats.todayCheckpoints = 0;
    stats.todayParagraphsRead = 0;
    stats.lastActiveDate = today;

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (const d of Object.keys(stats.dailyHistory)) {
      if (d < cutoff) delete stats.dailyHistory[d];
    }
  }

  if (type === 'CHECKPOINT') {
    stats.totalCheckpoints = (stats.totalCheckpoints || 0) + 1;
    stats.todayCheckpoints = (stats.todayCheckpoints || 0) + 1;
    stats.dailyHistory[today].checkpoints = (stats.dailyHistory[today].checkpoints || 0) + 1;
  } else if (type === 'SNAPBACK') {
    stats.totalSnapbacks = (stats.totalSnapbacks || 0) + 1;
    stats.todaySnapbacks = (stats.todaySnapbacks || 0) + 1;
    stats.dailyHistory[today].snapbacks = (stats.dailyHistory[today].snapbacks || 0) + 1;
    if (typeof value === 'number') {
      stats.totalDriftParagraphs = (stats.totalDriftParagraphs || 0) + value;
    }
  } else if (type === 'PARAGRAPH_READ') {
    stats.todayParagraphsRead = (stats.todayParagraphsRead || 0) + 1;
    stats.totalParagraphsRead = (stats.totalParagraphsRead || 0) + 1;
    stats.dailyHistory[today].paragraphs = (stats.dailyHistory[today].paragraphs || 0) + 1;
  } else if (type === 'SPRINT_COMPLETE') {
    stats.completedSprints = (stats.completedSprints || 0) + 1;
    if (typeof minutes === 'number' && minutes > 0) {
      stats.totalFocusMinutes = (stats.totalFocusMinutes || 0) + minutes;
    }
  }

  await chrome.storage.local.set({ stats });
}
