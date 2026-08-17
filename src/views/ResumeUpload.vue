<template>
  <div class="resume-upload">
    <!-- Token 输入 -->
    <div class="token-section">
      <div class="section-label">Token</div>
      <div class="token-input-wrap">
        <input
          v-model="tokenInput"
          class="token-input"
          type="text"
          placeholder="输入上传 Token"
          @blur="saveToken"
          @keyup.enter="saveToken"
        />
        <button class="token-save-btn" @click="saveToken">保存</button>
      </div>
    </div>

    <!-- 站点指示 -->
    <div class="site-indicator" v-if="siteName">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
      {{ siteName }}
    </div>

    <!-- 简历状态卡片 -->
    <div class="status-card" :class="resumeStatus.class">
      <div class="status-card-icon" v-html="resumeStatus.icon"></div>
      <div class="status-card-body">
        <div class="status-card-title">{{ resumeStatus.title }}</div>
        <div class="status-card-desc">{{ resumeStatus.desc }}</div>
      </div>
    </div>

    <!-- PDF 预览 -->
    <div class="pdf-section">
      <div class="section-label">简历文件</div>
      <div v-if="pdfUrl" class="pdf-card">
        <div class="pdf-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#E8F4FD" stroke="#2196F3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="14 2 14 8 20 8" stroke="#2196F3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="9" y1="13" x2="15" y2="13" stroke="#2196F3" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="9" y1="17" x2="13" y2="17" stroke="#2196F3" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="pdf-info">
          <div class="pdf-label">{{ siteName }} · 附件简历</div>
          <a :href="pdfUrl" target="_blank" class="pdf-link">点击查看 PDF</a>
        </div>
        <div class="pdf-check">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <div v-else-if="scanning" class="pdf-empty scanning">
        <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        正在扫描简历…
      </div>
      <div v-else class="pdf-empty">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        未检测到简历文件
      </div>
    </div>

    <!-- 上传按钮 -->
    <button
      class="btn-submit"
      :class="{ 'btn-submit--loading': submitting }"
      :disabled="!canSubmit || submitting"
      @click="handleUpload"
    >
      <span v-if="submitting" class="btn-icon">
        <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      </span>
      <span v-else class="btn-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </span>
      {{ submitting ? '提交中…' : '提交简历' }}
    </button>

    <!-- 结果提示 -->
    <div v-if="resultMsg" class="result-msg" :class="resultSuccess ? 'result-msg--success' : 'result-msg--error'">
      {{ resultMsg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { uploadFile } from '@/utils/uploadFile';
import logoUrl from '/icon-48.png'

// ── Token ───────────────────────────────────────────────────
const tokenInput = ref('');
const savedToken = ref('');

async function loadToken() {
  const { uploadToken } = await chrome.storage.local.get(['uploadToken']);
  tokenInput.value = uploadToken || '';
  savedToken.value = uploadToken || '';
}

async function saveToken() {
  savedToken.value = tokenInput.value.trim();
  if (savedToken.value) {
    await chrome.storage.local.set({ uploadToken: savedToken.value });
  } else {
    await chrome.storage.local.remove(['uploadToken']);
  }
}

// ── Site Detection ──────────────────────────────────────────
const siteName = ref('');
const siteType = ref<'zhipin' | 'liepin' | 'unknown'>('unknown');

async function detectSite() {
  const [tab = {} as any] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { url = '' } = tab;
  if (url.includes('liepin.com')) {
    siteType.value = 'liepin';
    siteName.value = '猎聘网';
  } else if (url.includes('zhipin.com')) {
    siteType.value = 'zhipin';
    siteName.value = 'BOSS直聘';
  } else {
    siteType.value = 'unknown';
    siteName.value = '';
  }
}

// ── PDF Detection ───────────────────────────────────────────
const pdfUrl = ref('');
const scanning = ref(false);
const recentUploads = ref<Record<string, number>>({});

const canSubmit = computed(() => !!savedToken.value && !!pdfUrl.value);

const resumeStatus = computed(() => {
  if (scanning.value) {
    return {
      class: 'loading',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A6CF7" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
      title: '正在扫描简历',
      desc: '请稍候…',
    };
  }
  if (pdfUrl.value) {
    return {
      class: 'success',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a9d5c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      title: '简历已获取',
      desc: `${siteName.value} · 附件简历`,
    };
  }
  return {
    class: 'warn',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e65100" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    title: '未检测到简历',
    desc: '请打开候选人沟通页再试',
  };
});

// ── Liepin Detection ────────────────────────────────────────
async function detectLiepin(tab: any) {
  try {
    const params: any = await chrome.runtime.sendMessage({ action: 'getRequests' });
    if (!params?.resIdEncode || !tab?.id) return;

    const addIframe = async (data: object) => {
      const res = await fetch('https://api-lpt.liepin.com/api/com.liepin.rresume.usere.pc.resume-view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-fscp-std-info': '{"client_id": "40156"}',
          'x-fscp-trace-id': 'f188e227-1283-43e4-82d1-042dc3875c50',
          'x-client-type': 'web',
          'x-fscp-version': '1.1',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: `pageParamVo=${JSON.stringify(data)}`,
        credentials: 'include',
      });
      return res.json();
    };

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: addIframe,
      args: [params],
    });

    const resumeData = results[0]?.result?.data?.resumeDetailVo;
    const attachmentResume = resumeData?.attachmentVo?.attachmentResume;

    if (attachmentResume?.downloadUrl) {
      pdfUrl.value = 'https://tdoss.liepin.com/o' + attachmentResume.downloadUrl;
    }
  } catch (e) {
    console.error('[ResumeUpload] 猎聘简历检测失败:', e);
  }
}

// ── Zhipin Detection ────────────────────────────────────────
async function detectZhipin(tab: any) {
  try {
    const res: any = await chrome.tabs.sendMessage(tab.id, { action: 'get boss pdf url' });
    if (res?.url) {
      pdfUrl.value = res.url;
    }
  } catch (e) {
    console.error('[ResumeUpload] BOSS简历检测失败:', e);
  }
}

// ── Upload ──────────────────────────────────────────────────
const submitting = ref(false);
const resultMsg = ref('');
const resultSuccess = ref(false);

async function handleUpload() {
  if (!pdfUrl.value) return;

  // Deduplicate: 5s cooldown per geekId
  const m = pdfUrl.value.match(/geekId=([a-zA-Z0-9]+)/);
  const geekId = m ? m[1] : '';
  const recent = recentUploads.value[geekId];
  if (recent && Date.now() - recent < 5000) {
    resultMsg.value = '⏳ 5秒内已提交过，请稍等';
    resultSuccess.value = false;
    return;
  }
  recentUploads.value[geekId] = Date.now();

  submitting.value = true;
  resultMsg.value = '';

  const filename = (pdfUrl.value.split('/').pop()?.match(/[^?#]+/)?.[0] || 'resume.pdf');
  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  try {
    const res = await uploadFile({
      sourceChannel: siteType.value === 'liepin' ? 'liepin' : 'boss',
      filename: safeName,
      url: pdfUrl.value,
      token: savedToken.value,
    });
    if (res.success) {
      resultMsg.value = '✅ 提交成功！可以前往HRM查看';
      resultSuccess.value = true;
    } else {
      resultMsg.value = `❌ 提交失败：${res.msg || '未知错误'}`;
      resultSuccess.value = false;
    }
  } catch (e: any) {
    resultMsg.value = `❌ 提交失败：${e.message || e}`;
    resultSuccess.value = false;
  } finally {
    submitting.value = false;
  }
}

// ── Init ────────────────────────────────────────────────────
onMounted(async () => {
  await loadToken();
  await detectSite();

  if (siteType.value === 'unknown') return;

  const [tab = {} as any] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Check chrome.storage.local for auto-detected PDF first
  const { autoDetectedPdf } = await chrome.storage.local.get(['autoDetectedPdf']);
  chrome.storage.local.remove('autoDetectedPdf');
  if (autoDetectedPdf?.url) {
    pdfUrl.value = autoDetectedPdf.url;
    return;
  }

  scanning.value = true;
  try {
    if (siteType.value === 'liepin') {
      await detectLiepin(tab);
    } else if (siteType.value === 'zhipin') {
      await detectZhipin(tab);
    }
  } finally {
    scanning.value = false;
  }
});
</script>

<style scoped>
.resume-upload {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;
}

/* Site indicator */
.site-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #4A6CF7;
  font-weight: 500;
  background: #EEF1FF;
  border-radius: 20px;
  padding: 4px 10px;
  align-self: flex-start;
}

/* Section label */
.section-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
}

/* Token input */
.token-section {
  padding: 0 2px;
}
.token-input-wrap {
  display: flex;
  gap: 6px;
}
.token-input {
  flex: 1;
  padding: 8px 12px;
  font-size: 13px;
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  outline: none;
  background: #f8f9fb;
  color: #333;
  transition: all 0.2s;
}
.token-input:focus {
  border-color: #4A6CF7;
  box-shadow: 0 0 0 3px rgba(74, 108, 247, 0.08);
  background: #fff;
}
.token-input::placeholder {
  color: #bbb;
  font-size: 13px;
}
.token-save-btn {
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #5B7CF6 0%, #7B5CF6 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.token-save-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Status card */
.status-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid transparent;
  transition: all 0.3s;
}
.status-card.loading { background: #f0f4ff; border-color: #dde3fd; }
.status-card.success { background: #e8f8ee; border-color: #c4e9d3; }
.status-card.warn { background: #fff8ee; border-color: #ffe4b8; }
.status-card-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.7);
}
.status-card-title {
  font-size: 14px;
  font-weight: 600;
  color: #222;
  line-height: 1.3;
}
.status-card-desc {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
}

/* PDF section */
.pdf-section {
  padding: 0 2px;
}
.pdf-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fbff;
  border: 1px solid #e0eaff;
  border-radius: 10px;
  padding: 12px 14px;
}
.pdf-icon { flex-shrink: 0; }
.pdf-info { flex: 1; min-width: 0; }
.pdf-label { font-size: 11px; color: #999; margin-bottom: 3px; }
.pdf-link {
  font-size: 13px;
  color: #4A6CF7;
  font-weight: 600;
  text-decoration: none;
}
.pdf-link:hover { text-decoration: underline; }
.pdf-check { flex-shrink: 0; }
.pdf-empty {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: #e65100;
  background: #fff8ee;
  border: 1px solid #ffe4b8;
  border-radius: 10px;
  padding: 11px 14px;
}
.pdf-empty.scanning { color: #4A6CF7; background: #f0f4ff; border-color: #dde3fd; }

/* Submit button */
.btn-submit {
  width: 100%;
  padding: 13px 16px;
  background: linear-gradient(135deg, #5B7CF6 0%, #7B5CF6 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s;
  box-shadow: 0 4px 14px rgba(91,124,246,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  letter-spacing: 0.5px;
}
.btn-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(91,124,246,0.45);
}
.btn-submit:active:not(:disabled) { transform: translateY(0); }
.btn-submit:disabled {
  background: linear-gradient(135deg, #ccc 0%, #bbb 100%);
  box-shadow: none;
  cursor: not-allowed;
}
.btn-submit--loading {
  background: linear-gradient(135deg, #9DB8FF 0%, #B5A0FF 100%);
  box-shadow: none;
}
.btn-icon { display: flex; align-items: center; }

/* Result message */
.result-msg {
  font-size: 13px;
  padding: 10px 14px;
  border-radius: 10px;
  line-height: 1.4;
  text-align: center;
}
.result-msg--success {
  background: #e8f8ee;
  border: 1px solid #c4e9d3;
  color: #1a9d5c;
}
.result-msg--error {
  background: #fff0f0;
  border: 1px solid #ffd0d0;
  color: #e74c3c;
}

/* Spin animation */
.spin-icon {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
