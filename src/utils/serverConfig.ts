/**
 * 服务器配置模块 — 动态切换后端 API 地址
 * 存储到 chrome.storage.local，key = 'apiServer'
 */

const DEFAULT_SERVER = 'http://localhost:3000';

export const SERVER_OPTIONS = [
  { label: '本地 (localhost:3000)', value: 'http://localhost:3000' },
  { label: '生产 (43.167.211.80)', value: 'http://43.167.211.80:3000' },
];

/**
 * 获取当前 API 服务器地址
 */
export async function getApiBase(): Promise<string> {
  const { apiServer } = await chrome.storage.local.get(['apiServer']);
  return apiServer || DEFAULT_SERVER;
}

/**
 * 设置 API 服务器地址（切换时清除旧的 token）
 */
export async function setApiBase(server: string): Promise<void> {
  const old = await getApiBase();
  if (old !== server) {
    // 切换服务器时清除旧凭据
    await chrome.storage.local.remove([
      'devUploadToken',
      'devCredentials',
      'devUsername',
    ]);
  }
  await chrome.storage.local.set({ apiServer: server });
}
