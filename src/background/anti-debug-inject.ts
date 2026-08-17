// 在 MAIN world 注入反调试脚本
// 使用 tabs.onUpdated 监听页面加载，比 webNavigation 更稳定

const ANTI_DEBUG_CODE = `
(function() {
  if (window.__antiDebugInjected) return;
  window.__antiDebugInjected = true;

  // 方案1：重写 Function.prototype.constructor，让 debugger 变成空操作
  const _constructor = Function.prototype.constructor;
  Function.prototype.constructor = function(...args) {
    if (args[0] && args[0].toString().includes('debugger')) {
      return function() {};
    }
    return _constructor.apply(this, args);
  };

  // 方案2：禁用 setInterval/setTimeout 中的 debugger
  const _setInterval = window.setInterval;
  window.setInterval = function(fn, delay, ...args) {
    if (typeof fn === 'string' && fn.includes('debugger')) {
      return -1;
    }
    if (fn instanceof Function) {
      const fnStr = fn.toString();
      if (fnStr.includes('debugger')) {
        return function() {};
      }
    }
    return _setInterval.call(window, fn, delay, ...args);
  };

  const _setTimeout = window.setTimeout;
  window.setTimeout = function(fn, delay, ...args) {
    if (typeof fn === 'string' && fn.includes('debugger')) {
      return -1;
    }
    if (fn instanceof Function) {
      const fnStr = fn.toString();
      if (fnStr.includes('debugger')) {
        return function() {};
      }
    }
    return _setTimeout.call(window, fn, delay, ...args);
  };

  // 方案3：覆盖 console.clear 防止清空控制台
  window.console.clear = function() {};

  // 方案4：禁用 debugger 关键字本身
  const _eval = window.eval;
  window.eval = function(code) {
    if (typeof code === 'string') {
      code = code.replace(/debugger/g, '');
    }
    return _eval.call(window, code);
  };

  console.log('[简历收集插件] 反调试保护已启用 ✅');
})();
`;

// 注入函数
async function injectAntiDebug(tabId: number) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (code: string) => {
        const script = document.createElement('script');
        script.textContent = code;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
      },
      args: [ANTI_DEBUG_CODE],
      world: 'MAIN',
    });
    console.log(`[AntiDebug] 已注入到 tab ${tabId}`);
  } catch (err) {
    console.error(`[AntiDebug] 注入失败 tab ${tabId}:`, err);
  }
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url?.includes('zhipin.com') && changeInfo.status === 'complete') {
    injectAntiDebug(tabId);
  }
});

// 监听标签页创建
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url?.includes('zhipin.com') && tab.id) {
    // 稍微延迟确保页面开始加载
    setTimeout(() => injectAntiDebug(tab.id!), 500);
  }
});

// 监听扩展图标点击，手动触发注入
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id && tab.url?.includes('zhipin.com')) {
    await injectAntiDebug(tab.id);
  }
});

export {};
