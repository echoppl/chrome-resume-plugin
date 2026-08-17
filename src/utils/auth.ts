/**
 * 认证模块 — 自动管理登录 Token
 * Token 存储在 chrome.storage.local，key = 'devUploadToken'
 * 登录凭据也存储，key = 'devCredentials'
 * API 地址通过 serverConfig 动态读取
 */

import { getApiBase } from './serverConfig';

// ─── 获取已存储的 Token ──────────────────────────────────────

export async function getToken(): Promise<string | null> {
  const { devUploadToken } = await chrome.storage.local.get(['devUploadToken']);
  return devUploadToken || null;
}

// ─── 登录 ────────────────────────────────────────────────────

export interface LoginResult {
  success: boolean;
  token?: string;
  username?: string;
  message?: string;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  try {
    const base = await getApiBase();
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (data.code === 200 && data.data?.token) {
      // 存储 token + 凭据
      await chrome.storage.local.set({
        devUploadToken: data.data.token,
        devCredentials: { username, password },
        devUsername: data.data.username || username,
      });
      return { success: true, token: data.data.token, username: data.data.username || username };
    }
    return { success: false, message: data.message || '登录失败' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, message: `网络错误: ${msg}` };
  }
}

// ─── 注册 ────────────────────────────────────────────────────

export async function register(username: string, password: string): Promise<LoginResult> {
  try {
    const base = await getApiBase();
    const res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (data.code === 200 && data.data?.token) {
      await chrome.storage.local.set({
        devUploadToken: data.data.token,
        devCredentials: { username, password },
        devUsername: data.data.username || username,
      });
      return { success: true, token: data.data.token, username: data.data.username || username };
    }
    return { success: false, message: data.message || '注册失败' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, message: `网络错误: ${msg}` };
  }
}

// ─── 登出 ────────────────────────────────────────────────────

export async function logout() {
  await chrome.storage.local.remove(['devUploadToken', 'devCredentials', 'devUsername']);
}

// ─── 获取已保存的凭据（用于自动填充）────────────────────────────

export async function getSavedCredentials(): Promise<{ username: string; password: string } | null> {
  const { devCredentials } = await chrome.storage.local.get(['devCredentials']);
  return devCredentials || null;
}

// ─── 获取已保存的用户名 ────────────────────────────────────────

export async function getUsername(): Promise<string | null> {
  const { devUsername } = await chrome.storage.local.get(['devUsername']);
  return devUsername || null;
}
