/**
 * 上传简历文件到云端服务
 * 接口: POST <server>/api/files/upload
 * Header: Authorization: Bearer <token>
 * 参数: file (multipart)
 * Token 由登录页自动管理，存储在 chrome.storage.local
 * API 地址由 serverConfig 统一提供（生产服务器）
 */

import { getToken } from './auth';
import { getApiBase } from './serverConfig';

async function getUploadApi(): Promise<string> {
  const base = await getApiBase();
  return `${base}/api/files/upload`;
}

// ─── 默认导出：PDF URL 直传（background 调用）──────────────────────────────

export interface UploadResult {
  success: boolean;
  data?: any;
  error?: string;
  sizeKB?: number;
}

export default async function (
  url: string,
  phone: string,
  filename: string
): Promise<UploadResult> {
  try {
    // 1. 下载 PDF
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`PDF 获取失败: HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const byteArray = new Uint8Array(arrayBuffer);
    const sizeKB = Math.round(byteArray.length / 1024);
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    console.log('[devUpload] PDF获取成功:', sizeKB, 'KB');

    // 2. 读取 token
    const devUploadToken = await getToken();
    if (!devUploadToken) {
      return { success: false, error: '未登录，请先点击插件图标登录' };
    }

    // 3. 上传
    const formData = new FormData();
    formData.append('file', blob, filename);

    const uploadRes = await fetch(await getUploadApi(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${devUploadToken}`,
      },
      body: formData,
    });

    if (!uploadRes.ok) throw new Error(`上传失败: HTTP ${uploadRes.status}`);
    const data = await uploadRes.json();
    console.log('[devUpload] ✅ 上传成功:', data);

    return { success: true, data, sizeKB };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[devUpload] ❌', error);
    return { success: false, error };
  }
}

// ─── uploadFile：候选人信息上传（popup 调用）────────────────────────────────

export async function uploadFile(form: any): Promise<{ success: boolean; msg?: string }> {
  try {
    // 1. 下载 PDF
    const fileRes = await fetch(form.url, { credentials: 'include' });
    const arrayBuffer = await fileRes.arrayBuffer();
    const byteArray = new Uint8Array(arrayBuffer);
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    // 2. 读取 token
    const devUploadToken = await getToken();
    if (!devUploadToken) {
      return { success: false, msg: '未登录，请先点击插件图标登录' };
    }

    // 3. 上传（只传 file 参数）
    const fd = new FormData();
    fd.append('file', blob, form.filename);

    const res = await fetch(await getUploadApi(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${devUploadToken}` },
      body: fd,
    });

    if (!res.ok) throw new Error(`上传失败: HTTP ${res.status}`);
    const data = await res.json();
    console.log('[devUpload] uploadFile ✅', data);
    return { success: true, msg: data.fileUrl || '上传成功' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[devUpload] uploadFile ❌', msg);
    return { success: false, msg };
  }
}
