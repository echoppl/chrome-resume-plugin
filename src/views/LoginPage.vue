<template>
  <div class="login-page">
    <!-- Logo + 品牌 -->
    <div class="login-brand">
      <img :src="logoUrl" alt="logo" class="login-logo" />
      <div class="login-brand-text">
        <div class="login-brand-name">智能简历收集</div>
        <div class="login-brand-sub">简历自动解析 · 云端管理</div>
      </div>
    </div>

    <!-- 表单 -->
    <div class="login-form">
      <div class="login-label">{{ isRegister ? '注册账号' : '登录账号' }}</div>

      <input
        ref="usernameRef"
        v-model="username"
        class="login-input"
        :class="{ 'input-error': error }"
        type="text"
        placeholder="请输入用户名"
        autocomplete="username"
        @keyup.enter="focusNext"
      />
      <input
        ref="passwordRef"
        v-model="password"
        class="login-input"
        :class="{ 'input-error': error }"
        type="password"
        placeholder="请输入密码（6位以上）"
        autocomplete="current-password"
        @keyup.enter="handleSubmit"
      />

      <!-- 错误提示 -->
      <div v-if="error" class="login-error">{{ error }}</div>

      <!-- 提交按钮 -->
      <button
        class="login-btn"
        :disabled="loading || !canSubmit"
        @click="handleSubmit"
      >
        <span v-if="loading" class="btn-spinner"></span>
        {{ loading ? (isRegister ? '注册中...' : '登录中...') : (isRegister ? '创建账号并登录' : '登  录') }}
      </button>
    </div>

    <!-- 切换 -->
    <div class="login-switch">
      <span v-if="!isRegister">
        没有账号？<a href="#" @click.prevent="switchMode('register')">立即注册</a>
      </span>
      <span v-else>
        已有账号？<a href="#" @click.prevent="switchMode('login')">去登录</a>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { login, register } from '@/utils/auth';
import logoUrl from '/icon-48.png';

const emit = defineEmits<{
  loginSuccess: [data: { username: string; token: string }]
}>();

const isRegister = ref(false);
const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const usernameRef = ref<HTMLInputElement>();
const passwordRef = ref<HTMLInputElement>();

const canSubmit = computed(() => username.value.trim() && password.value.length >= 6);

function switchMode(mode: 'login' | 'register') {
  isRegister.value = mode === 'register';
  error.value = '';
}

function focusNext() {
  passwordRef.value?.focus();
}

async function handleSubmit() {
  if (!canSubmit.value || loading.value) return;
  loading.value = true;
  error.value = '';

  try {
    const fn = isRegister.value ? register : login;
    const result = await fn(username.value.trim(), password.value);

    if (result.success) {
      emit('loginSuccess', { username: result.username || '', token: result.token || '' });
    } else {
      error.value = result.message || '操作失败';
    }
  } catch (e: any) {
    error.value = e.message || '网络错误，请确认服务已启动';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  width: 400px;
  min-height: 460px;
  padding: 40px 30px 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 品牌区 */
.login-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 32px;
}
.login-logo {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  flex-shrink: 0;
}
.login-brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.login-brand-name {
  font-size: 18px;
  font-weight: 600;
  color: #222;
  line-height: 1.3;
}
.login-brand-sub {
  font-size: 12px;
  color: #999;
  line-height: 1.2;
}

/* 表单 */
.login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.login-label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.login-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 15px;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  outline: none;
  transition: all 0.2s;
  background: #f8f9fb;
  color: #333;
}
.login-input:focus {
  border-color: #4A6CF7;
  box-shadow: 0 0 0 3px rgba(74, 108, 247, 0.08);
  background: #fff;
}
.login-input.input-error {
  border-color: #e74c3c;
  background: #fff;
}
.login-input::placeholder {
  color: #bbb;
  font-size: 14px;
}

.login-error {
  font-size: 13px;
  color: #e74c3c;
  background: #fff5f5;
  border-radius: 8px;
  padding: 8px 12px;
  line-height: 1.4;
}

.login-btn {
  width: 100%;
  padding: 13px 16px;
  background: linear-gradient(135deg, #5B7CF6 0%, #7B5CF6 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
  letter-spacing: 1px;
}
.login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(91, 124, 246, 0.4);
}
.login-btn:active:not(:disabled) {
  transform: translateY(0);
}
.login-btn:disabled {
  background: linear-gradient(135deg, #d5d5d5 0%, #c5c5c5 100%);
  cursor: not-allowed;
  box-shadow: none;
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: login-spin 0.6s linear infinite;
}

@keyframes login-spin {
  to { transform: rotate(360deg); }
}

.login-switch {
  margin-top: 24px;
  font-size: 13px;
  color: #aaa;
}
.login-switch a {
  color: #4A6CF7;
  text-decoration: none;
  font-weight: 500;
}
.login-switch a:hover {
  text-decoration: underline;
}
</style>
