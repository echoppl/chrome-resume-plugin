import axios from "axios";

const UPLOAD_API = import.meta.env.VITE_ENV + '/hrm-internet/user-profile/resume/upload';

export interface UploadResult {
  success: boolean;
  data?: any;
  error?: string;
  sizeKB?: number;
}

export default async function (url: string, phone: string, filename: string): Promise<UploadResult> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      throw new Error(`PDF 获取失败: HTTP ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const byteArray = new Uint8Array(arrayBuffer);
    const sizeKB = Math.round(byteArray.length / 1024);
    console.log(`[bgUpload] PDF获取成功: ${sizeKB}KB`);

    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('phone', phone || '');
    formData.append('file', blob, filename);

    console.log('[bgUpload] >>> 上传中:', UPLOAD_API, '| 文件:', filename, '| 大小:', sizeKB, 'KB');

    const uploadRes = await fetch(UPLOAD_API, {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) {
      throw new Error(`上传失败: HTTP ${uploadRes.status}`);
    }

    const data = await uploadRes.json();
    console.log('[bgUpload] ✅ 上传成功，后端响应:', data);
    return { success: true, data, sizeKB };

  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[bgUpload] ❌ 失败:', error);
    return { success: false, error };
  }
}


export async function uploadFile(form: any) {
  try {
    const fileRes = await fetch(form.url, { credentials: 'include' });
    const arrayBuffer = await fileRes.arrayBuffer();
    const byteArray = new Uint8Array(arrayBuffer);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const cookies = await chrome.cookies.getAll({ url: `${import.meta.env.VITE_ENV}/*` });
    const formData = new FormData();
    // formData.append('candidateJson', JSON.stringify(form));
    formData.append('candidateJson', form);
    formData.append('recruitNo', form.recruitNo || '');
    formData.append('sourceChannel', form.sourceChannel || '');
    formData.append('file', blob, form.filename);
    await axios.post(`${import.meta.env.VITE_ENV}/hrm/ats/resume/import`, formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Cookie': cookies.map((item: any) => `${item.name}=${item.value}`).join('; ')
      },
    });
    return { success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, msg: error || '提交失败' };
  }
}

export async function getRecruitDemandFlow () {
  try {
    const cookies = await chrome.cookies.getAll({ url: `${import.meta.env.VITE_ENV}/*` });
    const data =await axios.post(`${import.meta.env.VITE_ENV}/hrm/employee/recruitDemandFlow/list`, {
      displayStatus: "招聘中",
      pageSize: 999,
      pageNo: 1,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies.map((item: any) => `${item.name}=${item.value}`).join('; ')
      },
    });
    return data.data?.data?.records || []
  } catch (e) {
    console.error('获取猎聘页面信息失败:', e);
    return []
  }
}