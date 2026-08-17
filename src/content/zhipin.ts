// ============================================================
// Boss直聘 content script — 简历 PDF 下载 + 自动点击功能
// ============================================================

import { startAutoClick, stopAutoClick, isAutoClicking, clickElement } from '../utils/autoClick';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// injectAutoClickToMainWorld();

let lastPdfUrl = '';

// ========== ① MAIN world 注入：拦截 PDF blob URL ==========
(function injectMainWorldScript() {
  try {
    const script = document.createElement('script');
    script.id = '__zhipin_blob_interceptor';
    script.textContent = `
      (function() {
        var el = document.getElementById('__zhipin_pdf_bridge');
        if (!el) {
          el = document.createElement('meta');
          el.id = '__zhipin_pdf_bridge';
          el.setAttribute('name', 'zhipin-pdf-bridge');
          document.head.appendChild(el);
        }
        function appendBlob(info) {
          try {
            var raw = el.getAttribute('content') || '[]';
            var arr = JSON.parse(raw);
            arr.push(info);
            if (arr.length > 50) arr = arr.slice(-50);
            el.setAttribute('content', JSON.stringify(arr));
          } catch(e) {}
        }
        // 拦截 URL.createObjectURL
        var origCreateObjectURL = URL.createObjectURL;
        URL.createObjectURL = function(blob) {
          var url = origCreateObjectURL.call(this, blob);
          if (blob && blob.type && (blob.type.includes('pdf') || blob.type.includes('application'))) {
            appendBlob({ url: url, type: blob.type, size: blob.size, time: Date.now(), method: 'createObjectURL' });
          }
          return url;
        };
        // 拦截 fetch
        var origFetch = window.fetch;
        if (origFetch) {
          window.fetch = function(input, init) {
            return origFetch.call(this, input, init).then(function(resp) {
              var ct = resp.headers && resp.headers.get ? resp.headers.get('content-type') : '';
              if (ct && (ct.includes('pdf') || ct.includes('application/octet-stream'))) {
                var cloned = resp.clone();
                cloned.blob().then(function(b) {
                  appendBlob({ url: resp.url, type: ct, size: b.size, time: Date.now(), method: 'fetch' });
                }).catch(function(){});
              }
              return resp;
            });
          };
        }
        // 拦截 XMLHttpRequest
        var origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
          this.addEventListener('readystatechange', function() {
            if (this.readyState === 4) {
              var ct = this.getResponseHeader('Content-Type') || '';
              if (ct && (ct.includes('pdf') || ct.includes('octet-stream'))) {
                appendBlob({ url: url, type: ct, time: Date.now(), method: 'xhr' });
              }
            }
          });
          return origOpen.apply(this, arguments);
        };
      })();
    `;
    document.documentElement.appendChild(script);
    script.remove();
  } catch (e) { }
})();

// ========== ② 消息监听 ==========
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  // --- 下载 PDF（blob URL 或普通 URL）---
  if (msg.action === 'downloadPdfUrl') {
    const pdfUrl: string = msg.pdfUrl;

    // 去重：1秒内相同URL只处理第一次
    const now = Date.now();
    const last = (window as any).__lastDownload;
    if (last && last.url === pdfUrl && now - last.time < 1000) {
      sendResponse({ success: false, error: 'duplicate (1s)' });
      return false;
    }
    (window as any).__lastDownload = { url: pdfUrl, time: now };

    if (!pdfUrl) {
      sendResponse({ success: false, error: 'No URL provided' });
      return false;
    }

    const rawName = pdfUrl.split('/').pop()?.match(/[^?#]+/)?.[0] || 'resume';
    const filename = rawName.endsWith('.pdf') ? rawName : `${rawName}.pdf`;

    // blob URL：通过 fetch 转 blob 再触发下载
    if (pdfUrl.startsWith('blob:')) {
      fetch(pdfUrl).then(r => r.blob()).then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try { document.body.removeChild(a); } catch (e) { }
          URL.revokeObjectURL(blobUrl);
        }, 100);
        sendResponse({ success: true, method: 'blob-download', filename });
      }).catch(err => {
        sendResponse({ success: false, error: String(err) });
      });
      return true; // async
    }

    // 普通 URL：转发给 background script 用 chrome.downloads 下载
    chrome.runtime.sendMessage(
      { action: 'bgDownload', url: pdfUrl, filename },
      (res) => { sendResponse(res); }
    );
    return true;
  }

  // --- 扫描 PDF URL（供 popup/background 调用）---
  if (msg.action === 'scanPdfUrl') {
    // 1. 从 main world 读取拦截到的 blob URL（通过 DOM 桥接）
    let blobUrls: any[] = [];
    try {
      const bridge = document.getElementById('__zhipin_pdf_bridge');
      if (bridge) {
        const raw = bridge.getAttribute('content');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            blobUrls = parsed.map((b: any) => ({
              source: 'blob-interceptor',
              value: b.url,
              type: b.type,
              size: b.size,
              method: b.method,
            }));
          }
        }
      }
    } catch (e) { }

    // 2. 从背景脚本拿网络拦截 URL
    try {
      chrome.runtime.sendMessage({ action: 'getAllUrls' }, (allUrls) => {
        sendResponse({
          blobUrls: blobUrls,
          allUrls: allUrls || [],
        });
      });
    } catch (e) {
      sendResponse({ blobUrls: blobUrls, allUrls: [] });
    }
    return true; // async response
  }
  if (msg.action === 'get boss pdf url') {
    const modal = document.querySelector('.attachment-box.attachment-iframe')
    if (modal) {
      sendResponse({ url: lastPdfUrl });
    } else {
      sendResponse(false);
    }
    return true;
  }
});

// ========== ③ iframe 简历自动检测 — 检测到直接通知 background 弹窗 ==========
(function () {
  function isResumeIframe(iframe: HTMLIFrameElement): boolean {
    const src = iframe.src || '';
    if (!src) return false;
    return (
      src.match(/\.pdf(\?|#|$)/i) !== null ||
      src.includes('/preview4boss/') ||
      src.includes('/wflow/zpgeek/download/') ||
      src.includes('/bzl-office/') ||
      src.includes('/bzp-geek-resume/') ||
      src.includes('/resume/') ||
      src.includes('/geek/file') ||
      src.includes('/attachment') ||
      src.includes('pdf-viewer')
    );
  }

  // 从 PDF 查看器 URL 提取真实下载链接
  function extractRealPdfUrl(iframeSrc: string): string {
    const txt = document.createElement('textarea');
    txt.innerHTML = iframeSrc;
    const url = txt.value || iframeSrc;

    if (url.includes('bzl-office/pdf-viewer') || url.includes('pdf-viewer-b')) {
      try {
        const parsed = new URL(url);
        const encodedUrl = parsed.searchParams.get('url');
        if (encodedUrl) {
          const decoded = decodeURIComponent(encodedUrl);
          if (decoded.startsWith('/')) return parsed.origin + decoded;
          if (decoded.startsWith('http')) return decoded;
        }
      } catch { }
    }
    return url;
  }

  function triggerPopup(rawUrl: string) {
    const url = extractRealPdfUrl(rawUrl);
    console.log('[zhipin] 检测到简历 iframe, 提取下载链接:', url);
    lastPdfUrl = url;
    chrome.storage.local.set({
      autoDetectedPdf: {
        url: url,
        filename: url.split('/').pop()?.split('?')[0] || 'resume.pdf',
        source: 'boss-zhipin',
        detectedAt: new Date().toISOString(),
      },
    }, () => {
      chrome.runtime.sendMessage({ action: 'autoOpenPopup' }).catch(() => { });
    });
  }

  // 检查已有 iframe
  document.querySelectorAll<HTMLIFrameElement>('iframe').forEach(f => {
    if (isResumeIframe(f)) triggerPopup(f.src);
  });

  // 监听新增 iframe
  new MutationObserver((mutations) => {
    for (const m of Array.from(mutations)) {
      for (const node of Array.from(m.addedNodes)) {
        if (node instanceof HTMLIFrameElement && isResumeIframe(node)) {
          triggerPopup(node.src);
          return;
        }
        if (node instanceof Element) {
          const iframes = node.querySelectorAll<HTMLIFrameElement>('iframe[src]');
          for (let i = 0; i < iframes.length; i++) {
            const f = iframes[i];
            if (isResumeIframe(f)) { triggerPopup(f.src); return; }
          }
        }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  console.log('[zhipin] iframe 简历自动检测已启动');
})();

function extractZhipinResume() {
  const result: Record<string, any> = {};
  const allText = getAllVisibleText();
  const lines = allText.split('\n').filter(t => t.trim().length > 0);

  result._lines = lines;

  const classNames = getAllClassNames();

  // === 收集所有文本来源 ===
  const textSources: string[] = [];

  // 检查 iframes（简历内容通常在iframe里）
  document.querySelectorAll('iframe').forEach((iframe, idx) => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc && iframeDoc.body) {
        const walker = document.createTreeWalker(iframeDoc.body, NodeFilter.SHOW_TEXT, null);
        const texts: string[] = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const t = node.textContent?.trim();
          if (t && t.length > 2) texts.push(t);
        }
        if (texts.length > 0) {
          textSources.push(`iframe[${idx}]: ${texts.slice(0, 3).join(' | ')}`);
        }
      }
    } catch (_) { }
  });

  // 检查 Shadow DOMs
  document.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot) {
      textSources.push(`ShadowDOM`);
    }
  });

  result._textSources = textSources;
  result._pageText = allText.slice(0, 5000);

  // === 步骤1：提取手机号（最稳定，以它为锚点）===
  const phoneRegex = /1[3-9]\d{9}/g;
  const allPhones = allText.match(phoneRegex) || [];
  // 过滤掉163/164开头的（通常是CSS时间戳）
  const validPhones = allPhones.filter(p => !p.startsWith('163') && !p.startsWith('164'));
  if (validPhones.length > 0) {
    result.mobile = validPhones[0]; // 第一个有效手机号
    if (validPhones.length > 1) result._otherPhones = validPhones.slice(1);
  }

  // === 步骤2：提取邮箱 ===
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const allEmails = allText.match(emailRegex) || [];
  // 优先找163/126等常见邮箱，排除qq号（邮箱和qq号不同）
  const emailCandidates = allEmails.filter(e => !e.match(/^qq\d+@/));
  if (emailCandidates.length > 0) {
    result.email = emailCandidates[0];
  }

  if (!result.email) {
    const emailLineIndex = lines.findIndex(i => i.startsWith('@'));
    if (emailLineIndex > 1) {
      result.email = lines[emailLineIndex - 1] + lines[emailLineIndex];
    }
  }

  // === 步骤3：以手机号为锚点提取姓名 ===
  // 策略：手机号所在行及其上方2-3行内找姓名
  // 姓名特征：2-4个纯汉字，不在排除列表中
  const excludeNames = new Set([
    '职位管理', '牛人管理', '推荐牛人', '账号设置', '个人中心',
    '山西吕梁', '广东', '深圳', '北京', '上海', '成都', '杭州',
    '武汉', '南京', '西安', '广州', '苏州', '天津', '重庆',
    '简历', '查看详情', '展开', '收起', '已读', '未读',
    '消息', '聊天', '联系', '沟通', '打招呼',
    'boss直聘', 'BOSS直聘', '正在招聘', '职位详情',
  ]);

  const nameCandidateLines: string[] = [];
  const phoneLineIndex = lines.findIndex(l => l.match(phoneRegex));

  if (phoneLineIndex >= 0) {
    // 往上看手机号前2-3行，这些行通常包含姓名
    for (let i = Math.max(0, phoneLineIndex - 3); i < phoneLineIndex; i++) {
      const line = lines[i].trim();
      // 2-4个纯汉字，且不在排除列表
      if (/^[\u4e00-\u9fa5]{2,4}$/.test(line) && !excludeNames.has(line)) {
        nameCandidateLines.push(line);
      }
    }
    // 也检查手机号同一行
    if (phoneLineIndex < lines.length) {
      const sameLine = lines[phoneLineIndex].trim();
      // 如果同行有姓名（格式：姓名 手机号）
      const sameLineParts = sameLine.split(/\s+/);
      for (const part of sameLineParts) {
        if (/^[\u4e00-\u9fa5]{2,4}$/.test(part) && !excludeNames.has(part)) {
          nameCandidateLines.push(part);
        }
      }
    }
  }

  // 备选策略：找包含"姓名"标签的行
  const nameLabelLine = lines.find(l => l.includes('姓名') || l.includes('名字'));
  if (nameLabelLine) {
    const nameMatch = nameLabelLine.match(/姓名[：:\s]*([\u4e00-\u9fa5]{2,4})/);
    if (nameMatch) nameCandidateLines.push(nameMatch[1]);
  }

  // 从候选中选最佳（选最长/最可能的）
  if (nameCandidateLines.length > 0) {
    // 优先选手机号前1-2行的（最接近手机号的通常是姓名）
    result.name = nameCandidateLines.join(' | ');
  }

  // 使用百家姓匹配
  const sss = `赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐闫`;
  const names = lines.filter(l => sss.includes(l[0]));
  result.name = names[0]

  // === 步骤4：提取性别 ===
  // 格式通常是：性别：男 或 男 | 女 | 年龄
  const sexLine = lines.find(l => l.includes('性别'));
  if (sexLine) {
    if (sexLine.includes('男')) result.sexName = '男';
    else if (sexLine.includes('女')) result.sexName = '女';
  } else {
    // 从手机号所在行找
    if (phoneLineIndex >= 0) {
      const phoneLine = lines[phoneLineIndex];
      if (phoneLine.includes('男') && !phoneLine.includes('女')) result.sexName = '男';
      else if (phoneLine.includes('女') && !phoneLine.includes('男')) result.sexName = '女';
    }
  }

  // === 步骤5：提取年龄 ===
  const ageLine = lines.find(l => l.includes('年龄'));
  if (ageLine) {
    const ageMatch = ageLine.match(/年龄[：:]*\s*(\d+)/);
    if (ageMatch) result.age = parseInt(ageMatch[1]);
  }

  // === 步骤6：提取学历 ===
  const eduLevel: Record<string, number> = {
    '博士': 6, '硕士': 5, '本科': 4, '大专': 3, '中专': 2, '高中': 1, '初中': 0
  };
  for (const line of lines) {
    for (const edu of Object.keys(eduLevel)) {
      if (line.includes(edu)) {
        if (!result.degreeName || eduLevel[edu] > eduLevel[result.degreeName]) {
          result.degreeName = edu;
        }
      }
    }
  }

  // === 步骤7：提取工作经验年限 ===
  const expLine = lines.find(l => l.includes('年工作经验') || l.includes('年经验'));
  if (expLine) {
    const expMatch = expLine.match(/(\d+)\s*年工作?经验/);
    if (expMatch) result.workYears = parseInt(expMatch[1]);
  }

  // === 步骤8：以手机号为锚点提取最近2段工作经历 ===
  // 工作经历通常在手机号附近，或在页面的"工作经历"区块
  const experiences: any[] = [];

  // 找"工作经历"或"经历"标签所在行
  const expStartIdx = lines.findIndex(l =>
    l.includes('工作经历') || l.includes('经历') || l.includes('职业履历')
  );

  if (expStartIdx >= 0) {
    // 从"工作经历"标签往下找，最多10行
    for (let i = expStartIdx + 1; i < Math.min(expStartIdx + 15, lines.length); i++) {
      const line = lines[i].trim();
      // 公司名特征：包含"有限公司"、"集团"、"公司"等
      const compMatch = line.match(/([^\s\d][^\n|]{2,20}?(?:有限公司|集团|股份|科技|技术|有限|工作室|事务所))/) ||
        line.match(/([^\s\d][^\n|]{2,15}?公司)/) ||
        line.match(/([^\s\d][^\n|]{2,10}?(?:工作室|商行|营业部|分公司))/) ||
        line.match(/(字节|腾讯|阿里|百度|京东|美团|华为|小米|网易|滴滴|快手|抖音|淘天|蚂蚁|拼多多)/);

      if (compMatch && experiences.length < 2) {
        // 清理公司名（去掉时间等干扰）
        let compName = compMatch[1].replace(/\d{4}[年/-].*$/, '').trim();
        if (compName && compName.length > 2 && compName.length < 30) {
          experiences.push({ compName });
        }
      }
    }
  } else {
    // 没有明确的"工作经历"标签，以手机号为基准往前找
    // 通常工作经历在基本信息上方
    for (let i = Math.max(0, phoneLineIndex - 10); i < phoneLineIndex; i++) {
      const line = lines[i].trim();
      const compMatch = line.match(/(?:^|[^\u4e00-\u9fa5])([^\n|]{2,20}?(?:有限公司|集团|科技|股份))/) ||
        line.match(/(字节|腾讯|阿里|百度|京东|美团|华为|小米|网易|滴滴|快手|抖音)/);
      if (compMatch && experiences.length < 2) {
        let compName = (compMatch[1] || compMatch[0]).replace(/^\s*/, '').trim();
        if (compName && compName.length > 2) {
          experiences.push({ compName });
        }
      }
    }
  }

  if (experiences.length > 0) result.workExperiences = experiences;

  // === 步骤9：提取期望职位/城市 ===
  const cityKeywords = ['北京', '上海', '深圳', '广州', '杭州', '成都', '武汉', '南京', '西安', '苏州', '天津', '重庆', '东莞', '佛山', '长沙', '郑州', '济南', '青岛', '厦门', '宁波'];
  for (const line of lines) {
    for (const city of cityKeywords) {
      if (line.includes(city) && line.length < 30 && !line.includes('招聘')) {
        result.dqName = city;
        break;
      }
    }
    if (result.dqName) break;
  }

  // === 调试信息 ===
  result._debug = {
    phoneLineIndex,
    phoneLineContent: phoneLineIndex >= 0 ? lines[phoneLineIndex] : null,
    nameCandidateLines,
    totalLines: lines.length,
    classNameCount: classNames.length,
  };

  return result;
}

// ====== 工具函数 ======

function getClassString(el: Element): string {
  if (typeof el.className === 'string') return el.className;
  if (el.className && typeof el.className === 'object' && 'baseVal' in (el.className as any)) {
    return (el.className as any).baseVal || '';
  }
  return el.getAttribute('class') || '';
}

function getAllClassNames(): string[] {
  const classSet = new Set<string>();
  document.querySelectorAll('*').forEach(el => {
    const classStr = getClassString(el);
    if (!classStr) return;
    classStr.split(/\s+/).forEach((c: string) => {
      if (c && !c.startsWith('el-') && !c.startsWith('_') && c.length > 2) {
        classSet.add(c);
      }
    });
  });
  return Array.from(classSet).sort();
}

function getAllVisibleText(): string {
  // 优先从 iframes 获取文本
  let allTexts: string[] = [];

  document.querySelectorAll('iframe').forEach(iframe => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc?.body) {
        const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const t = node.textContent?.trim();
          if (t && t.length > 1) allTexts.push(t);
        }
      }
    } catch (_) { }
  });

  // 主文档
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const t = node.textContent?.trim();
    if (t && t.length > 1) allTexts.push(t);
  }

  return allTexts.join('\n');
}

// ====== 消息监听 ======
(window as any).__extractZhipinResume = extractZhipinResume;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'set bossResumeData') {
    const data = extractZhipinResume();
    sendResponse(data);
  }

  if (msg.action === 'startAutoClick boss') {
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
      callback: async () => {
        // 附件按钮
        const btn = document.querySelector('.btn.resume-btn-file')
        // 求简历按钮
        const getBtn = document.querySelector('.operate-exchange-left .operate-btn');
        const infoele = document.querySelector('.base-info-single-detial');
        const result: any = {};
        if (infoele) {
          const lines = infoele.innerHTML.split('\n');
          result.name = lines[0];
          result.age = lines[lines.length - 3];
          result.workYear = lines[lines.length - 2];
          result.education = lines[lines.length - 1];
        }
        if (!btn) return;
        // 附件按钮禁用时，点击求简历按钮
        if (btn.classList.contains('disabled')) {
          if (!getBtn) return;
          clickElement(getBtn);
          await new Promise(resolve => setTimeout(resolve, 500));
          const bossBtn = document.querySelector('.exchange-tooltip .boss-btn-primary.boss-btn');
          if (bossBtn) {
            clickElement(bossBtn);
          }
        } else {
          clickElement(btn);
          await sleep(4000);
          result.pdfUrl = lastPdfUrl
        }
        await chrome.runtime.sendMessage({ action: 'autoInsertResumeData boss', data: result }).catch(() => { });
      },
      onProgress: (current, total) => {
        chrome.runtime.sendMessage({ action: 'autoClickProgress boss', current, total }).catch(() => {});
      },
      onComplete: (successCount, totalCount) => {
        chrome.runtime.sendMessage({ action: 'autoClickComplete boss', successCount, totalCount }).catch(() => {});
      },
    }).then(result => {
      sendResponse(result);
    });
    
    return true;
  }

  if (msg.action === 'stopAutoClick boss') {
    stopAutoClick();
    sendResponse({ success: true, stopped: true });
  }

  if (msg.action === 'isAutoClicking boss') {
    sendResponse({ clicking: isAutoClicking() });
  }
  if (msg.action === 'sendMessage boss') {
    sendMessage(msg.message);
  }
});

async function sendMessage(message: string) {
  const input = document.querySelector('.boss-chat-editor-input');
  if (!input) return;
  input.innerHTML = message;
  await sleep(2000);
  const btn = document.querySelector('.submit-content .submit');
  if (btn && btn instanceof HTMLElement) btn.click();
}

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

(function(){
  new MutationObserver(() => {
    debounceOpenPopup();
  }).observe(document.documentElement, { childList: true, subtree: true });
  
})()

const debounceOpenPopup = debounce(() => {
  const modal = document.querySelector('.attachment-box.attachment-iframe');
  if (!modal) {
    chrome.runtime.sendMessage({ action: 'clear bossResumeData' });
  }
}, 500);