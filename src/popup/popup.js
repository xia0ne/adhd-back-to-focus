/**
 * 回神 · Back to Focus
 * Popup 脚本逻辑
 */

document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('focusToggle');
  const todaySnapbacksEl = document.getElementById('todaySnapbacks');
  const totalCheckpointsEl = document.getElementById('totalCheckpoints');
  const driftSavedEl = document.getElementById('driftSaved');

  // 获取当前标签页状态
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        toggle.checked = false;
      } else {
        toggle.checked = !!response.isEnabled;
      }
    });
  }

  // 读取统计数据
  const data = await chrome.storage.local.get(['stats']);
  const stats = data.stats || {};
  todaySnapbacksEl.textContent = stats.todaySnapbacks || 0;
  totalCheckpointsEl.textContent = stats.totalCheckpoints || 0;
  driftSavedEl.textContent = stats.totalDriftParagraphs || 0;

  // 切换开关
  toggle.addEventListener('change', () => {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_FOCUS' }, (response) => {
        if (chrome.runtime.lastError) {
          // 当前页面可能不支持或未注入脚本（如 chrome:// 页面）
          toggle.checked = false;
        } else if (response) {
          toggle.checked = !!response.isEnabled;
        }
      });
    }
  });
});
