/**
 * 回神 · Back to Focus
 * Popup 脚本逻辑：标签页切换、偏好设置同步、精细数据统计与 7 日专注趋势图
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

  // 7 日趋势图元素
  const barChartContainer = document.getElementById('barChartContainer');
  const chartAvgText = document.getElementById('chartAvgText');
  const chartFooterCaption = document.getElementById('chartFooterCaption');

  // 设置元素
  const settingEnableDblClick = document.getElementById('settingEnableDblClick');
  const settingAutoScroll = document.getElementById('settingAutoScroll');
  const settingKeepDriftMarks = document.getElementById('settingKeepDriftMarks');
  const settingAutoFoldThinking = document.getElementById('settingAutoFoldThinking');
  const dimChips = document.querySelectorAll('.dim-chip');

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

  // 计算过去 7 天日期基准
  function getLast7Days() {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
      const isToday = (i === 0);
      const label = isToday ? '今日' : `周${dayOfWeek}`;
      days.push({
        dateStr: iso,
        label,
        isToday,
        monthDay: `${d.getMonth() + 1}月${d.getDate()}日`
      });
    }
    return days;
  }

  // 4. 加载并渲染统计数据与 7 日柱状图
  function renderStats(stats = {}) {
    todaySnapbacksEl.textContent = stats.todaySnapbacks || 0;
    todayParagraphsEl.textContent = stats.todayParagraphsRead || 0;
    todayCheckpointsEl.textContent = stats.todayCheckpoints || 0;
    totalSnapbacksEl.textContent = `${stats.totalSnapbacks || 0} 次`;
    totalDriftSavedEl.textContent = `${stats.totalDriftParagraphs || 0} 段`;
    completedSprintsEl.textContent = `${stats.completedSprints || 0} 次`;
    totalParagraphsEl.textContent = `${stats.totalParagraphsRead || 0} 段`;

    // 渲染近 7 日专注趋势图 (Apple 屏幕使用时间条形图风格)
    const days = getLast7Days();
    const history = stats.dailyHistory || {};

    let total7DaysParagraphs = 0;
    let total7DaysSnapbacks = 0;

    const chartData = days.map((day) => {
      let p = 0, s = 0;
      if (day.isToday) {
        p = stats.todayParagraphsRead || 0;
        s = stats.todaySnapbacks || 0;
      } else if (history[day.dateStr]) {
        p = history[day.dateStr].paragraphs || 0;
        s = history[day.dateStr].snapbacks || 0;
      }
      total7DaysParagraphs += p;
      total7DaysSnapbacks += s;
      return { ...day, paragraphs: p, snapbacks: s };
    });

    const maxP = Math.max(10, ...chartData.map(d => d.paragraphs));

    barChartContainer.innerHTML = '';
    chartData.forEach((item) => {
      const col = document.createElement('div');
      col.className = `chart-col ${item.isToday ? 'is-today' : ''}`;
      col.title = `${item.monthDay} (${item.label}): 精读 ${item.paragraphs} 段 · 回神 ${item.snapbacks} 次`;

      const heightPct = Math.max(6, Math.min(100, Math.round((item.paragraphs / maxP) * 100)));

      col.innerHTML = `
        <div class="bar-track">
          <div class="bar-fill" style="height: ${heightPct}%;"></div>
        </div>
        <span class="bar-day-label">${item.label}</span>
      `;
      barChartContainer.appendChild(col);
    });

    const avgP = Math.round(total7DaysParagraphs / 7);
    chartAvgText.textContent = `日均 ${avgP} 段`;
    chartFooterCaption.textContent = `近 7 日共精读 ${total7DaysParagraphs} 段 · 主动回神 ${total7DaysSnapbacks} 次`;
  }

  // 5. 加载并渲染偏好设置
  function renderSettings(settings = {}) {
    settingEnableDblClick.checked = !!settings.enableDblClick;
    settingAutoScroll.checked = settings.autoScroll !== false;
    settingKeepDriftMarks.checked = settings.keepDriftMarks !== false;
    settingAutoFoldThinking.checked = settings.autoFoldThinking !== false;

    const dim = settings.dimLevel || 'standard';
    dimChips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.dim === dim);
    });
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

  // 聚光灯聚焦强度切片点击
  dimChips.forEach(chip => {
    chip.addEventListener('click', async () => {
      const dim = chip.dataset.dim;
      dimChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const data = await chrome.storage.local.get(['settings']);
      const s = data.settings || {};
      s.dimLevel = dim;
      await chrome.storage.local.set({ settings: s });
    });
  });

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
