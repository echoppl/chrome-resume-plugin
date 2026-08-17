import { startAutoClick, stopAutoClick, isAutoClicking } from '../utils/autoClick2';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'startAutoClick liepin') {
    const { selector, delay = 1000, maxRetries = 3, stopOnError = false } = msg;

    if (isAutoClicking()) {
      sendResponse({ success: false, error: '正在执行自动点击' });
      return false;
    }

    const elements: Element[] = Array.from(document.querySelectorAll(selector));
    if (elements.length === 0) {
      sendResponse({ success: false, error: '未找到目标元素' });
      return false;
    }

    startAutoClick({
      elements,
      delay,
      maxRetries,
      stopOnError,
      onProgress: (current, total) => {
        chrome.runtime.sendMessage({ action: 'autoClickProgress liepin', current, total }).catch(() => { });
      },
      onComplete: (successCount, totalCount) => {
        chrome.runtime.sendMessage({ action: 'autoClickComplete liepin', successCount, totalCount }).catch(() => { });
      },
    }).then(result => {
      sendResponse(result);
    });

    return true;
  }

  if (msg.action === 'stopAutoClick liepin') {
    stopAutoClick();
    sendResponse({ success: true, stopped: true });
  }

  if (msg.action === 'isAutoClicking liepin') {
    sendResponse({ clicking: isAutoClicking() });
  }
})



chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'startAutoClick liepin') {
    const { selector, delay = 1000, maxRetries = 3, stopOnError = false } = msg;

    if (isAutoClicking()) {
      sendResponse({ success: false, error: '正在执行自动点击' });
      return false;
    }

    const elements: Element[] = Array.from(document.querySelectorAll(selector));
    if (elements.length === 0) {
      sendResponse({ success: false, error: '未找到目标元素' });
      return false;
    }

    startAutoClick({
      elements,
      delay,
      maxRetries,
      stopOnError,
      onProgress: (current, total) => {
        chrome.runtime.sendMessage({ action: 'autoClickProgress liepin', current, total }).catch(() => {});
      },
      onComplete: (successCount, totalCount) => {
        chrome.runtime.sendMessage({ action: 'autoClickComplete liepin', successCount, totalCount }).catch(() => {});
      },
    }).then(result => {
      sendResponse(result);
    });
    
    return true;
  }

  if (msg.action === 'stopAutoClick liepin') {
    stopAutoClick();
    sendResponse({ success: true, stopped: true });
  }

  if (msg.action === 'isAutoClicking liepin') {
    sendResponse({ clicking: isAutoClicking() });
  }
});


// 
let isOpened = false;
// 防抖函数
function debounce(func: (...args: any[]) => void, delay: number) {
  let timeout: number | null = null;
  return function (...args: any[]) {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

const debounceSetflag = debounce(() => {
  isOpened = false;
}, 500);

(function () {
  new MutationObserver(() => {
    const modal = document.querySelector('.ant-lpt-modal');
    if (modal && !isOpened) {
      chrome.runtime.sendMessage({ action: 'autoOpenPopup liepin' });
      isOpened = true;
    }
    if (!modal && isOpened) {
      debounceSetflag();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})()
