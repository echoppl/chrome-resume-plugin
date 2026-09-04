/**
 * 服务器配置模块 — API 地址统一走生产服务器
 * （历史版本支持 chrome.storage.local 切换本地/生产，已按产品化要求移除切换入口）
 */

const DEFAULT_SERVER = 'http://43.167.211.80:3000';

/**
 * 获取当前 API 服务器地址
 * 兼容历史数据：若本地存储里残留 localhost 配置，一律归一到生产地址
 */
export async function getApiBase(): Promise<string> {
  const { apiServer } = await chrome.storage.local.get(['apiServer']);
  if (!apiServer || apiServer !== DEFAULT_SERVER) {
    // 残留的 localhost 旧配置或空值 → 统一重置为生产地址
    await chrome.storage.local.set({ apiServer: DEFAULT_SERVER });
    return DEFAULT_SERVER;
  }
  return DEFAULT_SERVER;
}
