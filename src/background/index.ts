import uploadFile from '../utils/uploadFile';

let liepinRequests: any[] = [];
let zhipinRequests: any[] = [];
let zhipinPdfUrls: { url: string, method: string, timeStamp: number }[] = [];
let allZhipinUrls: { url: string, method: string, timeStamp: number, type?: string }[] = [];
const MAX_REQUESTS = 100;
let recentDownloads = new Map<string, number>();
const DEDUP_MS = 5000;

chrome.action.onClicked.addListener(async (tab) => {
  console.log('点击了操作按钮', tab);
});

chrome.commands?.onCommand.addListener(async (command) => {
  console.log('收到命令:', command);
});

// 猎聘：拦截简历查看请求
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.url.indexOf('com.liepin.rresume.usere.pc.resume-view') > -1) {
      const { formData } = details.requestBody as any;
      if (!formData) return;
      const { pageParamVo } = formData;
      if (!pageParamVo) return;
      const params = JSON.parse(pageParamVo[0] || '{}');
      if (!params.resIdEncode) return;
      if (params.viewLoadType) return;
      liepinRequests.push(params);
    }
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

// Boss直聘：拦截简历相关API请求
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.url.includes('zhipin.com') && details.url.includes('/api/boss/recommend/')) {
      zhipinRequests.push({ url: details.url, method: details.method, timeStamp: details.timeStamp });
      if (zhipinRequests.length > MAX_REQUESTS) zhipinRequests = zhipinRequests.slice(-MAX_REQUESTS);
    }
  },
  { urls: ['*://*.zhipin.com/*'] },
  []
);

// 通知 content script 数据已就绪
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.url.includes('zhipin.com') && details.statusCode === 200) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'ZHIPIN_API_COMPLETED', url: details.url }).catch(() => { });
        }
      });
    }
  },
  { urls: ['*://*.zhipin.com/*'] }
);

// 拦截 Boss直聘所有请求 — 收集 PDF URL
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.url.includes('zhipin.com')) {
      const entry = { url: details.url.slice(0, 500), method: details.method, timeStamp: details.timeStamp, type: details.type };
      allZhipinUrls.push(entry);
      if (allZhipinUrls.length > 200) allZhipinUrls = allZhipinUrls.slice(-200);

      if (
        details.url.match(/\.pdf(\?|#|$)/i) ||
        details.url.includes('/wflow/zpgeek/download/') ||
        details.url.includes('/bzl-office/pdf-viewer-b') ||
        details.url.includes('/resume/download') ||
        details.url.includes('/resume/file') ||
        details.url.includes('/geek/file') ||
        details.url.includes('/attachment') ||
        details.url.includes('bzp-geek-resume') ||
        details.url.includes('preview4boss') ||
        details.url.includes('content-disposition')
      ) {
        if (!zhipinPdfUrls.find(p => p.url === details.url)) {
          zhipinPdfUrls.push(entry);
          if (zhipinPdfUrls.length > 50) zhipinPdfUrls = zhipinPdfUrls.slice(-50);
        }
      }
    }
  },
  { urls: ['*://*.zhipin.com/*'] },
  []
);

// 拦截 response header 检测 PDF 内容类型
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const contentType = details.responseHeaders?.find(h => h.name.toLowerCase() === 'content-type')?.value || '';
    const contentDisp = details.responseHeaders?.find(h => h.name.toLowerCase() === 'content-disposition')?.value || '';
    if (details.url.includes('zhipin.com') && (contentType.includes('application/pdf') || contentDisp.includes('attachment') || contentDisp.includes('.pdf'))) {
      if (!zhipinPdfUrls.find(p => p.url === details.url)) {
        zhipinPdfUrls.push({ url: details.url.slice(0, 500), method: details.method, timeStamp: details.timeStamp });
        if (zhipinPdfUrls.length > 50) zhipinPdfUrls = zhipinPdfUrls.slice(-50);
      }
    }
  },
  { urls: ['*://*.zhipin.com/*'] },
  ['responseHeaders']
);

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'getRequests') {
    sendResponse(liepinRequests[liepinRequests.length - 1]);
    return true;
  }
  if (request.action === 'getZhipinRequests') {
    sendResponse(zhipinRequests);
    return true;
  }
  if (request.action === 'getPdfUrls') {
    sendResponse(zhipinPdfUrls);
    return true;
  }
  if (request.action === 'getAllUrls') {
    sendResponse(allZhipinUrls);
    return true;
  }
  if (request.action === 'bgDownload') {
    const { url, filename } = request;
    const now = Date.now();
    const last = recentDownloads.get(url);
    if (last && now - last < DEDUP_MS) {
      console.log('[bgDownload] 忽略5秒内重复:', url);
      sendResponse({ success: false, error: 'duplicate' });
      return;
    }
    recentDownloads.set(url, now);
    for (const [k, v] of recentDownloads) {
      if (now - v > 10000) recentDownloads.delete(k);
    }
    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    chrome.downloads.download({ url, filename: safeFilename, saveAs: true }, (dlId) => {
      if (chrome.runtime.lastError) {
        console.error('[bgDownload]', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('[bgDownload] 成功 dlId=', dlId);
        sendResponse({ success: true, method: 'bg-download', dlId });
      }
    });
    return true;
  }

  // =============== 自动打开 popup（从 content script 触发） ===============
  if (request.action === 'autoOpenPopup') {
    console.log('[background] 收到 autoOpenPopup');
    // 显示 badge 徽章，提示用户点击
    chrome.action.setBadgeText({ text: '📄' });
    chrome.action.setBadgeBackgroundColor({ color: '#00C9A7' });
    // 尝试直接打开 popup（Chrome 可能不支持，所以 badge 是保底）
    try { chrome.action.openPopup(); } catch (e) { /* badge 兜底 */ }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'bgUpload') {
    const { pdfUrl, filename, phone } = request;
    console.log('[bgUpload] 开始处理 PDF:', pdfUrl);
    uploadFile(pdfUrl, phone || '', filename).then(result => {
      sendResponse({
        success: result.success,
        method: 'http-upload',
        response: result.data,
        error: result.error,
      });
    });
    return true;
  }

  if (request.action === 'publish HRM resume') {
    publicJobData = JSON.parse(request.data || '{}')
    openpublistResumeDialog()
  }

  if (request.action === 'get publish request') {
    sendResponse({ publicJobData, zhipinRequestHeader, hrmRequestHeader, formPopupWindowId });
    return true;
  }
  if (request.action === 'open table') {
    console.log('[background] 收到 open table');
    sendResponse({ success: true });
    tablePopupWindow()
    return true;
  }
  if (request.action === 'autoOpenPopup liepin') {
    try { chrome.action.openPopup(); } catch (e) { /* badge 兜底 */ }
    sendResponse({ success: true });
    return true;
  }
  if (request.action === 'autoInsertResumeData boss') {
    
  }
});

// background.js
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (details.url.includes('https://www.zhipin.com/wapi/zpjob/job/data/list')) {
      zhipinRequestHeader = details.requestHeaders;
    }
    if (details.url.includes(`${import.meta.env.VITE_ENV}/hrm/`)) {
      hrmRequestHeader = details.requestHeaders;
    }
  },
  { urls: ["<all_urls>"] },
  ['requestHeaders'] // 必须指定此额外信息以获取头数据
);

let publicJobData: any = {}
let hrmRequestHeader: any = {}
let zhipinRequestHeader: any = {}

const formPopupWindow = createPopupWindow('form.html', 800, 600)
const tablePopupWindow = createPopupWindow('table.html', 800, 600)

let formPopupWindowId: any = null
async function openpublistResumeDialog() {
  const allTabs = await chrome.tabs.query({})
  // 创建前检查之前是否已创建过标签页
  const tabLiepin: any = allTabs.find((tab: any) => tab.url.indexOf('https://lpt.liepin.com') > -1)
  const tabZhipin: any = allTabs.find((tab: any) => tab.url.indexOf('https://www.zhipin.com') > -1)
  if (!tabLiepin) {
    chrome.tabs.create({ url: 'https://lpt.liepin.com/job/manager', active: false })
  } else {
    chrome.tabs.update(tabLiepin.id, { url: 'https://lpt.liepin.com/job/manager' })
  }
  if (!tabZhipin) {
    chrome.tabs.create({ url: 'https://www.zhipin.com/web/chat/job/list', active: false })
  } else {
    chrome.tabs.update(tabZhipin.id, { url: 'https://www.zhipin.com/web/chat/job/list' })
  }
  formPopupWindowId = await formPopupWindow()
}

function createPopupWindow(url: string, popupWidth: number = 800, popupHeight: number = 600) {
  let popupWindowId: any
  return async () => {
    if (popupWindowId) {
      try {
        const existingWindow = await chrome.windows.get(popupWindowId);
        if (!existingWindow) return
        await chrome.windows.update(popupWindowId, { focused: true });
        return popupWindowId;
      } catch (error) {
        console.log('窗口不存在，创建新窗口');
        popupWindowId = null;
      }
    }
    const displayInfo = await chrome.system.display.getInfo();
    const primaryDisplay = displayInfo.find(d => d.isPrimary) || displayInfo[0];
    const { width, height, left, top } = primaryDisplay.bounds;

    const popupWindow = await chrome.windows.create({
      url,
      type: 'popup',
      focused: true,
      width: popupWidth,
      height: popupHeight,
      left: left + Math.floor((width - popupWidth) / 2),
      top: top + Math.floor((height - popupHeight) / 2),
    });
    popupWindowId = popupWindow.id
    return popupWindowId;
  }
}