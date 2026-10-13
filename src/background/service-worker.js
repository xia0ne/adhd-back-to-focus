/**
 * 回神 · Back to Focus
 * Background Service Worker
 */

const DEFAULT_SETTINGS = {
  pingIntervalMinutes: 2,
  dimOpacity: 0.2,
  autoFoldThinking: true,
  autoScroll: true
};

const DEFAULT_STATS = {
  totalCheckpoints: 0,
  totalSnapbacks: 0,
  totalDriftParagraphs: 0,
  todaySnapbacks: 0,
  lastActiveDate: new Date().toISOString().slice(0, 10)
};

// 初始化默认配置
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['settings', 'stats']);
  if (!data.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  if (!data.stats) {
    await chrome.storage.local.set({ stats: DEFAULT_STATS });
  }
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
  }
});

async function handleRecordEvent({ type, value }) {
  const data = await chrome.storage.local.get(['stats']);
  const stats = data.stats || { ...DEFAULT_STATS };
  const today = new Date().toISOString().slice(0, 10);

  // 跨天重置当日数据
  if (stats.lastActiveDate !== today) {
    stats.todaySnapbacks = 0;
    stats.lastActiveDate = today;
  }

  if (type === 'CHECKPOINT') {
    stats.totalCheckpoints = (stats.totalCheckpoints || 0) + 1;
  } else if (type === 'SNAPBACK') {
    stats.totalSnapbacks = (stats.totalSnapbacks || 0) + 1;
    stats.todaySnapbacks = (stats.todaySnapbacks || 0) + 1;
    if (typeof value === 'number') {
      stats.totalDriftParagraphs = (stats.totalDriftParagraphs || 0) + value;
    }
  }

  await chrome.storage.local.set({ stats });
}
