<template>
  <LoginPage
    v-if="showLogin"
    @loginSuccess="onLoginSuccess"
  />

  <div v-else class="plugin-container">
    <div class="plugin-header">
      <img class="header-logo" :src="logoUrl" alt="logo" />
      <div class="header-text">
        <span class="header-title">丰巢简历收集</span>
        <span class="header-sub">{{ siteName || '本地服务' }}</span>
      </div>
      <button class="logout-btn" @click="handleLogout" title="退出登录">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    </div>

    <LiePinApp v-if="showLiepin"/>
    <BossApp v-if="showZhipin"/>
    <div style="display: flex; gap: 20px;" v-if="!showLiepin && !showZhipin">
      <a href="https://lpt.liepin.com/" target="_blank">打开猎聘网</a>
      <a href="https://www.zhipin.com/web/chat/index" target="_blank">打开boss直聘</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import BossApp from './views/BossApp.vue'
import LiePinApp from './views/LiePinApp.vue'
import LoginPage from './views/LoginPage.vue'
import { getToken, logout } from './utils/auth'
import logoUrl from '/icon-48.png'

const showZhipin = ref(false)
const showLiepin = ref(false)
const showLogin = ref(true)
const siteName = ref('')

async function checkLogin() {
  const token = await getToken();
  showLogin.value = !token;
}

async function detectSite() {
  const [tab = {} as any] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { url = '' } = tab;
  showZhipin.value = false;
  showLiepin.value = false;
  siteName.value = '';
  if (url.indexOf('liepin.com') > -1) {
    showLiepin.value = true;
    siteName.value = '猎聘';
  } else if (url.indexOf('zhipin.com') > -1) {
    showZhipin.value = true;
    siteName.value = 'BOSS直聘';
  }
}

function onLoginSuccess(_data: { username: string; token: string }) {
  showLogin.value = false;
  detectSite();
}

async function handleLogout() {
  await logout();
  showLogin.value = true;
  showZhipin.value = false;
  showLiepin.value = false;
  siteName.value = '';
}

onMounted(async () => {
  await checkLogin();
  if (showLogin.value) return;
  await detectSite();
});
</script>
