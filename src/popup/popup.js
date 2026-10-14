/**
 * 回神 · Back to Focus
 * Popup 脚本逻辑：标签页切换、偏好设置同步与精细数据统计
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM 元素
  const focusToggle = document.getElementById('focusToggle');
  const tabBtnStats = document.getElementById('tabBtnStats');
  const tabBtnSettings = document.getElementById('tabBtnSettings');
  const tabStats = document.getElementById('tabStats');
  const tabSettings = document.getElementById('tabSettings');

  // 统计元素
  const todaySnapbacksEl = document.getElementById('todaySnapbacks');
  const todayParagraphsEl = document.getElementById('todayParagraphs');
  const todayCheckpointsEl = document.getElementById('todayCheckpoints');
  const totalSnapbacksEl = document.getElementById('totalSnapbacks');
  const totalDriftSavedEl = document.getElementById('totalDriftSaved');
  const completedSprintsEl = document.getElementById('completedSprints');
  const totalParagraphsEl = document.getElementById('totalParagraphs');
  const btnResetStats = document.getElementById('btnResetStats');

  // 设置开关
  const settingEnableDblClick = document.getElementById('settingEnableDblClick');
  const settingAutoScroll = document.getElementById('settingAutoScroll');
  const settingKeepDriftMarks = document.getElementById('settingKeepDriftMarks');
  const settingAutoFoldThinking = document.getElementById('settingAutoFoldThinking');

  // 1. 获取当前标签页聚焦状态
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        focusToggle.checked = false;
      } else {
        focusToggle.checked = !!response.isEnabled;
      }
    });
  }

  // 2. 聚焦模式总开关
  focusToggle.addEventListener('change', () => {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_FOCUS' }, (response) => {
        if (chrome.runtime.lastError) {
          focusToggle.checked = false;
        } else if (response) {
          focusToggle.checked = !!response.isEnabled;
        }
      });
    }
  });

  // 3. Apple 分段控件 Tab 切换
  function switchTab(tabName) {
    if (tabName === 'stats') {
      tabBtnStats.classList.add('active');
      tabBtnSettings.classList.remove('active');
      tabBtnStats.setAttribute('aria-selected', 'true');
      tabBtnSettings.setAttribute('aria-selected', 'false');
      tabStats.classList.add('active');
      tabSettings.classList.remove('active');
    } else {
      tabBtnSettings.classList.add('active');
      tabBtnStats.classList.remove('active');
      tabBtnSettings.setAttribute('aria-selected', 'true');
      tabBtnStats.setAttribute('aria-selected', 'false');
      tabSettings.classList.add('active');
      tabStats.classList.remove('active');
    }
  }

  tabBtnStats.addEventListener('click', () => switchTab('stats'));
  tabBtnSettings.addEventListener('click', () => switchTab('settings'));

  // 4. 加载并渲染统计数据
  function renderStats(stats = {}) {
    todaySnapbacksEl.textContent = stats.todaySnapbacks || 0;
    todayParagraphsEl.textContent = stats.todayParagraphsRead || 0;
    todayCheckpointsEl.textContent = stats.todayCheckpoints || 0;
    totalSnapbacksEl.textContent = `${stats.totalSnapbacks || 0} 次`;
    totalDriftSavedEl.textContent = `${stats.totalDriftParagraphs || 0} 段`;
    completedSprintsEl.textContent = `${stats.completedSprints || 0} 次`;
    totalParagraphsEl.textContent = `${stats.totalParagraphsRead || 0} 段`;
  }

  // 5. 加载并渲染偏好设置
  function renderSettings(settings = {}) {
    settingEnableDblClick.checked = !!settings.enableDblClick;
    settingAutoScroll.checked = settings.autoScroll !== false;
    settingKeepDriftMarks.checked = settings.keepDriftMarks !== false;
    settingAutoFoldThinking.checked = settings.autoFoldThinking !== false;
  }

  // 读取初始配置与统计
  const storageData = await chrome.storage.local.get(['settings', 'stats']);
  renderStats(storageData.stats);
  renderSettings(storageData.settings);

  // 6. 偏好设置更新持久化
  async function saveSettings() {
    const data = await chrome.storage.local.get(['settings']);
    const settings = data.settings || {};
    settings.enableDblClick = settingEnableDblClick.checked;
    settings.autoScroll = settingAutoScroll.checked;
    settings.keepDriftMarks = settingKeepDriftMarks.checked;
    settings.autoFoldThinking = settingAutoFoldThinking.checked;
    await chrome.storage.local.set({ settings });
  }

  settingEnableDblClick.addEventListener('change', saveSettings);
  settingAutoScroll.addEventListener('change', saveSettings);
  settingKeepDriftMarks.addEventListener('change', saveSettings);
  settingAutoFoldThinking.addEventListener('change', saveSettings);

  // 7. 重置统计数据
  btnResetStats.addEventListener('click', () => {
    if (confirm('确定要重置所有主动回神与阅读统计数据吗？此操作不可撤销。')) {
      chrome.runtime.sendMessage({ action: 'RESET_STATS' }, (res) => {
        if (res && res.stats) {
          renderStats(res.stats);
        }
      });
    }
  });

  // 8. 实时同步变更 (例如多标签页或页面内快捷设置修改时)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.stats) renderStats(changes.stats.newValue);
      if (changes.settings) renderSettings(changes.settings.newValue);
    }
  });
});
