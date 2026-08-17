<template>
  <div class="liepin-app">
    <!-- 简历状态卡片 -->
    <div class="status-card" :class="resumeStatus.class">
      <div class="status-card-icon" v-html="resumeStatus.icon"></div>
      <div class="status-card-body">
        <div class="status-card-title">{{ resumeStatus.title }}</div>
        <div class="status-card-desc">{{ resumeStatus.desc }}</div>
      </div>
    </div>

    <!-- 表单 -->
    <el-form label-position="top" class="app-form">
      <!-- PDF 预览 -->
      <el-form-item label="简历文件">
        <div v-if="attachmentResumeFile.downloadUrl" class="pdf-card">
          <div class="pdf-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#FFF3E0" stroke="#FF9800" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="14 2 14 8 20 8" stroke="#FF9800" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="9" y1="13" x2="15" y2="13" stroke="#FF9800" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="9" y1="17" x2="13" y2="17" stroke="#FF9800" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="pdf-info">
            <div class="pdf-label">猎聘网 · 附件简历</div>
            <a :href="'https://tdoss.liepin.com/o'+attachmentResumeFile.downloadUrl" target="_blank" class="pdf-link">点击查看 PDF</a>
          </div>
          <div class="pdf-check">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
        <div v-else class="pdf-empty">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          未检测到附件简历
        </div>
      </el-form-item>

      <!-- 提交按钮 -->
      <el-form-item>
        <button
          class="btn-submit"
          :class="{ 'btn-submit--loading': submit }"
          :disabled="!canSubmit || submit"
          @click="submitForm"
        >
          <span v-if="submit" class="btn-icon">
            <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </span>
          <span v-else class="btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </span>
          {{ submit ? '提交中…' : '提交简历' }}
        </button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { uploadFile } from '@/utils/uploadFile';
import { ElMessage } from 'element-plus';

const attachmentResumeFile = ref<{ name: string; downloadUrl: string }>({ name: '', downloadUrl: '' });
const submit = ref(false);

const canSubmit = computed(() => !!attachmentResumeFile.value.downloadUrl);

const resumeStatus = computed(() => {
  if (attachmentResumeFile.value.downloadUrl) {
    return {
      class: 'success',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a9d5c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      title: '简历已获取',
      desc: '猎聘网 · 附件简历',
    };
  }
  return {
    class: 'warn',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e65100" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    title: '未检测到附件简历',
    desc: '请打开候选人沟通页再试',
  };
});

async function addIframe() {
  return async (data: object) => {
    const res = await fetch('https://api-lpt.liepin.com/api/com.liepin.rresume.usere.pc.resume-view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        "x-fscp-std-info": '{"client_id": "40156"}',
        "x-fscp-trace-id": "f188e227-1283-43e4-82d1-042dc3875c50",
        'x-client-type': "web",
        'x-fscp-version': '1.1',
        'x-requested-with': 'XMLHttpRequest',
      },
      body: `pageParamVo=${JSON.stringify(data)}`,
      credentials: 'include'
    }).then((response) => response.json());
    const { baseInfo, eduExperiences, attachmentVo } = res.data.resumeDetailVo;
    const { attachmentResume } = attachmentVo;
    return { ...baseInfo, eduExperiences, attachmentResume };
  };
}

async function initLiepin(tab: any) {
  try {
    const params: any = await chrome.runtime.sendMessage({ action: 'getRequests' });
    if (!params?.resIdEncode || !tab?.id) return;
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: await addIframe(),
      args: [params],
    });
    fillFormFromLiepin(results[0].result);
  } catch (e) {
    console.error('获取猎聘页面信息失败:', e);
  }
}

function fillFormFromLiepin(data: any) {
  const { attachmentResume } = data;
  attachmentResumeFile.value = attachmentResume || { name: '', downloadUrl: '' };
}

onMounted(async () => {
  const [tab = {} as any] = await chrome.tabs.query({ active: true, currentWindow: true });
  await initLiepin(tab);
});

async function submitForm() {
  const { name, downloadUrl } = attachmentResumeFile.value;
  if (!downloadUrl) {
    ElMessage.error('⚠️ 未检测到附件简历');
    return;
  }
  submit.value = true;
  try {
    const res = await uploadFile({
      sourceChannel: 'liepin',
      filename: name,
      url: 'https://tdoss.liepin.com/o' + downloadUrl,
    });
    if (res.success) {
      ElMessage.success('✅ 提交成功！可以前往HRM查看');
    } else {
      ElMessage.error(`❌ 提交失败：${res.msg || '未知错误'}`);
    }
  } catch (e: any) {
    ElMessage.error(`❌ 提交失败：${e.message || e}`);
  } finally {
    submit.value = false;
  }
}
</script>

<style scoped>
.liepin-app {
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
.status-card.loading {
  background: #f0f4ff;
  border-color: #dde3fd;
}
.status-card.success {
  background: #e8f8ee;
  border-color: #c4e9d3;
}
.status-card.warn {
  background: #fff8ee;
  border-color: #ffe4b8;
}
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

/* 表单 */
.app-form :deep(.el-form-item) {
  margin-bottom: 12px;
}
.app-form :deep(.el-form-item__label) {
  font-size: 12px;
  font-weight: 600;
  color: #888;
  padding-bottom: 6px !important;
  letter-spacing: 0.5px;
}

/* PDF 卡片 */
.pdf-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fffaf0;
  border: 1px solid #ffe4b8;
  border-radius: 10px;
  padding: 12px 14px;
}
.pdf-icon { flex-shrink: 0; }
.pdf-info { flex: 1; min-width: 0; }
.pdf-label { font-size: 11px; color: #999; margin-bottom: 3px; }
.pdf-link {
  font-size: 13px;
  color: #FF9800;
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

/* 提交按钮 */
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
.btn-submit:active:not(:disabled) {
  transform: translateY(0);
}
.btn-submit:disabled {
  background: linear-gradient(135deg, #ccc 0%, #bbb 100%);
  box-shadow: none;
  cursor: not-allowed;
}
.btn-submit--loading {
  background: linear-gradient(135deg, #9DB8FF 0%, #B5A0FF 100%);
  box-shadow: none;
}
.btn-icon {
  display: flex;
  align-items: center;
}

/* 旋转动画 */
.spin-icon {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
