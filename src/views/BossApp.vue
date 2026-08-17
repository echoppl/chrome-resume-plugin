<template>
  <div class="boss-app">
    <!-- 简历状态卡片 -->
    <div class="status-card" :class="resumeStatus.class">
      <div class="status-card-icon" v-html="resumeStatus.icon"></div>
      <div class="status-card-body">
        <div class="status-card-title">{{ resumeStatus.title }}</div>
        <div class="status-card-desc">{{ resumeStatus.desc }}</div>
      </div>
    </div>

    <!-- PDF 预览 -->
    <el-form-item label="简历文件">
      <div v-if="latestPdfUrl" class="pdf-card">
        <div class="pdf-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#E8F4FD" stroke="#2196F3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="14 2 14 8 20 8" stroke="#2196F3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="9" y1="13" x2="15" y2="13" stroke="#2196F3" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="9" y1="17" x2="13" y2="17" stroke="#2196F3" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="pdf-info">
          <div class="pdf-label">BOSS直聘 · 附件简历</div>
          <a :href="latestPdfUrl" target="_blank" class="pdf-link">点击查看 PDF</a>
        </div>
        <div class="pdf-check">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <div v-else-if="pdfScanning" class="pdf-empty scanning">
        <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        正在扫描简历…
      </div>
      <div v-else class="pdf-empty">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        未检测到简历文件
      </div>
    </el-form-item>

    <!-- 提交按钮 -->
    <el-form-item>
      <button
        class="btn-submit"
        :class="{ 'btn-submit--loading': submitting }"
        :disabled="!canSubmit || submitting"
        @click="submitUpload"
      >
        <span v-if="submitting" class="btn-icon">
          <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        </span>
        <span v-else class="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </span>
        {{ submitting ? '提交中…' : '提交简历' }}
      </button>
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { uploadFile } from '@/utils/uploadFile';

const pdfScanning = ref(false);
const submitting = ref(false);
const currentTab = ref<any>(null);
const latestPdfUrl = ref('');
const recentUploads = ref<Record<string, number>>({});

const canSubmit = computed(() => !!latestPdfUrl.value);

const resumeStatus = computed(() => {
  if (pdfScanning.value) {
    return {
      class: 'loading',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A6CF7" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
      title: '正在扫描简历',
      desc: '请稍候…',
    };
  }
  if (latestPdfUrl.value) {
    return {
      class: 'success',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a9d5c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      title: '简历已获取',
      desc: 'BOSS直聘 · 附件简历',
    };
  }
  return {
    class: 'warn',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e65100" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    title: '未检测到简历',
    desc: '请打开候选人沟通页再试',
  };
});

onMounted(async () => {
  const [tab = {} as any] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab.value = tab;
  chrome.action.setBadgeText({ text: '' });

  const { autoDetectedPdf } = await chrome.storage.local.get(['autoDetectedPdf']);
  chrome.storage.local.remove('autoDetectedPdf');
  if (autoDetectedPdf?.url) {
    latestPdfUrl.value = autoDetectedPdf.url;
    return;
  }

  await scanPdfUrl(tab);
});

async function scanPdfUrl(tab: any) {
  if (!tab) return;
  pdfScanning.value = true;
  latestPdfUrl.value = '';
  try {
    const res: any = await chrome.tabs.sendMessage(tab.id, { action: 'get boss pdf url' });
    latestPdfUrl.value = res?.url || '';
  } finally {
    pdfScanning.value = false;
  }
}

async function submitUpload() {
  if (!latestPdfUrl.value) {
    ElMessage.warning('⚠️ 未检测到简历PDF');
    return;
  }

  const m = latestPdfUrl.value.match(/geekId=([a-zA-Z0-9]+)/);
  const geekId = m ? m[1] : '';
  const recent = recentUploads.value[geekId];
  if (recent && Date.now() - recent < 5000) {
    ElMessage.warning('⏳ 5秒内已提交过，请稍等');
    return;
  }
  recentUploads.value[geekId] = Date.now();

  submitting.value = true;
  const filename = latestPdfUrl.value.split('/').pop()?.match(/[^?#]+/)?.[0] || 'resume.pdf';
  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  try {
    const res: any = await uploadFile({
      sourceChannel: 'boss',
      filename: safeName,
      url: latestPdfUrl.value,
    });
    if (res.success) {
      ElMessage.success('✅ 提交成功！');
    } else {
      ElMessage.error(`❌ 提交失败：${res?.msg || '未知错误'}`);
    }
  } catch (e: any) {
    ElMessage.error(`❌ 提交失败：${e.message || e}`);
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.boss-app {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 状态卡片 */
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
.status-card-title { font-size: 14px; font-weight: 600; color: #222; line-height: 1.3; }
.status-card-desc { font-size: 12px; color: #888; margin-top: 2px; }

/* 表单 */
.boss-app :deep(.el-form-item) { margin-bottom: 0; }
.boss-app :deep(.el-form-item__label) {
  font-size: 12px; font-weight: 600; color: #888;
  padding-bottom: 6px !important; letter-spacing: 0.5px;
}

/* PDF 卡片 */
.pdf-card {
  display: flex; align-items: center; gap: 12px;
  background: #f8fbff; border: 1px solid #e0eaff;
  border-radius: 10px; padding: 12px 14px;
}
.pdf-icon { flex-shrink: 0; }
.pdf-info { flex: 1; min-width: 0; }
.pdf-label { font-size: 11px; color: #999; margin-bottom: 3px; }
.pdf-link { font-size: 13px; color: #4A6CF7; font-weight: 600; text-decoration: none; }
.pdf-link:hover { text-decoration: underline; }
.pdf-check { flex-shrink: 0; }
.pdf-empty {
  display: flex; align-items: center; gap: 7px;
  font-size: 13px; color: #e65100; background: #fff8ee;
  border: 1px solid #ffe4b8; border-radius: 10px; padding: 11px 14px;
}
.pdf-empty.scanning { color: #4A6CF7; background: #f0f4ff; border-color: #dde3fd; }

/* 提交按钮 */
.btn-submit {
  width: 100%; padding: 13px 16px;
  background: linear-gradient(135deg, #5B7CF6 0%, #7B5CF6 100%);
  color: #fff; font-size: 15px; font-weight: 600;
  border: none; border-radius: 10px; cursor: pointer;
  transition: all 0.25s;
  box-shadow: 0 4px 14px rgba(91,124,246,0.35);
  display: flex; align-items: center; justify-content: center; gap: 8px;
  letter-spacing: 0.5px;
}
.btn-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(91,124,246,0.45);
}
.btn-submit:active:not(:disabled) { transform: translateY(0); }
.btn-submit:disabled {
  background: linear-gradient(135deg, #ccc 0%, #bbb 100%);
  box-shadow: none; cursor: not-allowed;
}
.btn-submit--loading {
  background: linear-gradient(135deg, #9DB8FF 0%, #B5A0FF 100%);
  box-shadow: none;
}
.btn-icon { display: flex; align-items: center; }

.spin-icon { animation: spin 0.8s linear infinite; }
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
