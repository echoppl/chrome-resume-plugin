export interface AutoClickOptions {
  selector?: string;
  elements?: NodeListOf<Element> | Element[];
  callback?: () => void;
  delay?: number;
  maxRetries?: number;
  stopOnError?: boolean;
  onProgress?: (current: number, total: number, element: Element) => void;
  onComplete?: (successCount: number, totalCount: number) => void;
  onError?: (index: number, element: Element, error: Error) => void;
  checkElementValid?: (element: Element) => boolean;
}

export interface AutoClickResult {
  success: boolean;
  successCount: number;
  totalCount: number;
  errors: Array<{ index: number; error: string }>;
  stopped: boolean;
}

let autoClicking = false;
let shouldStop = false;

export const stopAutoClick = (): void => {
  shouldStop = true;
};

export const isAutoClicking = (): boolean => {
  return autoClicking;
};

export const clickElement = (element: Element): boolean => {
  try {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return false;
    }

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });

    const dispatched = element.dispatchEvent(clickEvent);

    if (!dispatched) {
      (element as HTMLElement).click();
    }

    return true;
  } catch {
    return false;
  }
};

export const startAutoClick = async (options: AutoClickOptions): Promise<AutoClickResult> => {
  if (autoClicking) {
    return { success: false, successCount: 0, totalCount: 0, errors: [], stopped: false };
  }

  autoClicking = true;
  shouldStop = false;

  const {
    selector,
    elements,
    delay = 3000,
    maxRetries = 3,
    stopOnError = false,
    callback,
    onProgress,
    onComplete,
    onError,
    checkElementValid,
  } = options;

  let targetElements: Element[] = [];

  if (elements) {
    targetElements = Array.from(elements);
  } else if (selector) {
    targetElements = Array.from(document.querySelectorAll(selector));
  } else {
    autoClicking = false;
    return { success: false, successCount: 0, totalCount: 0, errors: [], stopped: false };
  }

  const totalCount = targetElements.length;
  let successCount = 0;
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < totalCount; i++) {
    if (shouldStop) {
      break;
    }

    const element = targetElements[i];

    if (!element) {
      errors.push({ index: i, error: '元素不存在' });
      onError?.(i, element as Element, new Error('元素不存在'));
      continue;
    }

    if (checkElementValid && !checkElementValid(element)) {
      errors.push({ index: i, error: '元素无效' });
      onError?.(i, element, new Error('元素无效'));
      continue;
    }

    let clicked = false;
    let retries = 0;

    while (retries < maxRetries && !clicked) {
      clicked = clickElement(element);
      await new Promise(resolve => setTimeout(resolve, 500));
      await callback?.();
      if (!clicked) {
        retries++;
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay / 2));
        }
      }
    }

    if (clicked) {
      successCount++;
      onProgress?.(i + 1, totalCount, element);
    } else {
      errors.push({ index: i, error: '点击失败' });
      onError?.(i, element, new Error('点击失败'));

      if (stopOnError) {
        break;
      }
    }

    if (i < totalCount - 1 && !shouldStop) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  autoClicking = false;
  onComplete?.(successCount, totalCount);

  return {
    success: successCount > 0,
    successCount,
    totalCount,
    errors,
    stopped: shouldStop,
  };
};

export const startAutoClickWithMutation = async (
  options: AutoClickOptions & { containerSelector?: string; timeout?: number }
): Promise<AutoClickResult> => {
  const { containerSelector = 'body', timeout = 60000, ...baseOptions } = options;

  return new Promise<AutoClickResult>((resolve) => {
    const startTime = Date.now();
    let elementsFound = false;

    const observer = new MutationObserver((mutations) => {
      if (shouldStop || elementsFound) return;

      const container = document.querySelector(containerSelector);
      if (!container) return;

      let targetElements: Element[] = [];

      if (baseOptions.elements) {
        targetElements = Array.from(baseOptions.elements);
      } else if (baseOptions.selector) {
        targetElements = Array.from(container.querySelectorAll(baseOptions.selector));
      }

      if (targetElements.length > 0) {
        elementsFound = true;
        observer.disconnect();
        startAutoClick({ ...baseOptions, elements: targetElements }).then(resolve);
      }

      if (timeout > 0 && Date.now() - startTime > timeout) {
        observer.disconnect();
        resolve({ success: false, successCount: 0, totalCount: 0, errors: [{ index: 0, error: '超时未找到元素' }], stopped: false });
      }
    });

    const container = document.querySelector(containerSelector);
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
    } else {
      resolve({ success: false, successCount: 0, totalCount: 0, errors: [{ index: 0, error: '容器元素不存在' }], stopped: false });
    }

    setTimeout(() => {
      if (!elementsFound) {
        observer.disconnect();
        resolve({ success: false, successCount: 0, totalCount: 0, errors: [{ index: 0, error: '超时未找到元素' }], stopped: false });
      }
    }, timeout);
  });
};

export const injectAutoClickToMainWorld = (): void => {
  try {
    const script = document.createElement('script');
    script.textContent = `
      window.__autoClickApi = {
        autoClicking: false,
        shouldStop: false,
        stopAutoClick: function() { this.shouldStop = true; },
        isAutoClicking: function() { return this.autoClicking; },
        clickElement: function(element) {
          try {
            var rect = element.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return false;
            var clickEvent = new MouseEvent('click', {
              bubbles: true, cancelable: true, view: window,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2
            });
            var dispatched = element.dispatchEvent(clickEvent);
            if (!dispatched) element.click();
            return true;
          } catch(e) { return false; }
        },
        startAutoClick: async function(options) {
          if (this.autoClicking) return { success: false, successCount: 0, totalCount: 0, errors: [], stopped: false };
          this.autoClicking = true;
          this.shouldStop = false;
          var { selector, elements, delay = 3000, maxRetries = 3, stopOnError = false } = options || {};
          var targetElements = elements ? Array.from(elements) : (selector ? Array.from(document.querySelectorAll(selector)) : []);
          var totalCount = targetElements.length;
          var successCount = 0;
          var errors = [];
          for (var i = 0; i < totalCount; i++) {
            if (this.shouldStop) break;
            var element = targetElements[i];
            if (!element) { errors.push({index: i, error: '元素不存在'}); continue; }
            var clicked = false;
            var retries = 0;
            while (retries < maxRetries && !clicked) {
              clicked = this.clickElement(element);
              if (!clicked) { retries++; if (retries < maxRetries) await new Promise(r => setTimeout(r, delay/2)); }
            }
            if (clicked) successCount++;
            else { errors.push({index: i, error: '点击失败'}); if (stopOnError) break; }
            if (i < totalCount - 1 && !this.shouldStop) await new Promise(r => setTimeout(r, delay));
          }
          this.autoClicking = false;
          return { success: successCount > 0, successCount, totalCount, errors, stopped: this.shouldStop };
        }
      };
    `;
    document.documentElement.appendChild(script);
    script.remove();
  } catch {}
};

export default {
  startAutoClick,
  startAutoClickWithMutation,
  stopAutoClick,
  isAutoClicking,
  injectAutoClickToMainWorld,
};