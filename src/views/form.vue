<template>
  <div class="form-page">
    <!-- 头部 -->
    <div class="plugin-header">
      <img class="header-logo" :src="logoUrl" alt="logo" />
      <div class="header-text">
        <span class="header-title">智能简历一键发布</span>
        <span class="header-sub">多平台职位同步发布</span>
      </div>
    </div>

    <!-- 表单区域 -->
    <div class="form-body">
      <RecruitmentForm ref="recruitmentFormRef">
        <button type="button"
          class="btn-publish"
          :disabled="timecount > 0 || publishing"
          @click="pushResumeData"
        >
          <span v-if="publishing" class="btn-icon">
            <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </span>
          <span v-else class="btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </span>
          {{ timecount > 0 ? `${timecount}s 后可发布` : publishing ? '发布中…' : '一键发布' }}
        </button>
      </RecruitmentForm>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import createJobData from '@/utils/createJobData.ts'
import RecruitmentForm from '@/components/RecruitmentForm.vue'
import logoUrl from '/icon-48.png'

// 倒计时 & 发布状态
const canPublish = ref(true)
const publishing = ref(false)
let timecount = ref(10)
let timerId = setInterval(() => {
  timecount.value--
  if (timecount.value <= 0) {
    clearInterval(timerId)
    canPublish.value = false
  }
}, 1000);

const recruitmentFormRef = ref<InstanceType<typeof RecruitmentForm>>()
onMounted(async () => {
  const { publicJobData }: any = await chrome.runtime.sendMessage({ action: 'get publish request' });
  recruitmentFormRef.value?.setData(publicJobData)
})

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const closeFrom = async () => {
  const { formPopupWindowId } = await chrome.runtime.sendMessage({ action: 'get publish request' });
  chrome.windows.remove(formPopupWindowId)
}

const pushResumeData = async () => {
  const tabs = await chrome.tabs.query({})
  const formData: any = await recruitmentFormRef.value?.exportData()
  if (!formData) {
    ElMessage.warning('⚠️ 请填写完整表单后重试')
    return
  }
  if (formData.publishPlatform.length === 0) {
    return ElMessage.error('请先选择发布平台')
  }

  const tabLiepin: any = tabs.find((tab: any) => tab.url.indexOf('https://lpt.liepin.com') > -1)

  if (formData.publishPlatform.includes('猎聘网')) {
    if (!tabLiepin) {
      await ElMessageBox.confirm('猎聘网未登录，是否前往登录', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await chrome.tabs.create({ url: 'https://lpt.liepin.com/job/manager', active: true })
      return await closeFrom()
    }
    if (tabLiepin?.url.indexOf('/login') > -1) {
      await ElMessageBox.confirm('猎聘网未登录，是否前往登录', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await chrome.tabs.update(tabLiepin.id, { active: true })
      return await closeFrom()
    }
  }

  const tabZhipin: any = tabs.find((tab: any) => tab.url.indexOf('https://www.zhipin.com') > -1)
  if (formData.publishPlatform.includes('boss直聘')) {
    if (!tabZhipin) {
      await ElMessageBox.confirm('boss直聘未登录，是否前往登录', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await chrome.tabs.create({ url: 'https://www.zhipin.com/web/chat/job/list', active: true })
      return await closeFrom()
    }
    if (tabZhipin?.url?.indexOf('/web/user') > -1) {
      await ElMessageBox.confirm('boss直聘未登录，是否前往登录', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await chrome.tabs.update(tabZhipin.id, { active: true })
      return await closeFrom()
    }
  }

  publishing.value = true
  
  if (formData.publishPlatform.includes('猎聘网') && tabLiepin) {
    const jobData = createJobData('猎聘网', formData)
    let publishLiePinResult = await chrome.scripting.executeScript({
      target: { tabId: tabLiepin.id },
      func: async (data: any) => {
        try {
          const request = (url: string, data: any) => {
            var params = []
            for (var key in data) {
              if (typeof data[key] === 'string') {
                params.push(`${key}=${data[key]}`)
              } else {
                params.push(`${key}=${JSON.stringify(data[key])}`)
              }
            }
            return fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                "x-fscp-std-info": '{"client_id": "40156"}',
                "x-fscp-trace-id": "f188e227-1283-43e4-82d1-042dc3875c50",
                'x-client-type': "web",
                'x-fscp-version': '1.1',
                'x-requested-with': 'XMLHttpRequest',
              },
              body: params.join('&'),
              credentials: 'include'
            }).then((response) => response.json());
          }
          const res: any = await request('https://api-lpt.liepin.com/api/com.liepin.job.b.ejobsuggest.get-title-suggest-list', {
            ejobTitle: data.ejobSaveInputVo.ejobTitle,
            ejobType: '0'
          });
          const jobInfo = res?.data?.ejobJobtitleSuggestList[0]
          if (!jobInfo || !jobInfo.jobtitleCode) {
            return { state: false, msg: '发布招聘信息失败: 该岗位在猎聘网未找到' }
          }
          data.ejobSaveInputVo.ejobJobtitle = jobInfo.jobtitleCode,
          await request('https://api-lpt.liepin.com/api/com.liepin.kuafu.ejobmanage.pc.ejobinfomaintain.publish-ejob', data);
          return { state: true }
        } catch (error) {
          return { state: false, msg: '发布招聘信息失败: ' + error }
        }
      },
      args: [jobData]
    })
    if (!publishLiePinResult[0].result.state) {
      publishing.value = false
      return ElMessage({ message: publishLiePinResult[0].result.msg, type: 'error', duration: 6000 })
    }
  }
  if (formData.publishPlatform.includes('boss直聘') && tabZhipin) {
    const { zhipinRequestHeader } = await chrome.runtime.sendMessage({ action: 'get publish request' });
    const jobData = createJobData('boss直聘', formData)
    let publishZhiPinResult = await chrome.scripting.executeScript({
      target: { tabId: tabZhipin.id },
      func: async (data, headers: any) => {
        const zp_token = headers.find((header: any) => header.name === 'zp_token')
        const traceid = headers.find((header: any) => header.name === 'traceid')
        try {
          const getParams = (obj: any) => {
            var params = []
            for (var key in obj) {
              if (typeof obj[key] === 'string') {
                params.push(`${key}=${encodeURIComponent(obj[key])}`)
              } else if (Array.isArray(obj[key])) {
                obj[key].forEach((item: string) => {
                  params.push(`${key}[]=${encodeURIComponent(item)}`)
                })
              } else {
                params.push(`${key}=${encodeURIComponent(JSON.stringify(obj[key]))}`)
              }
            }
            return params.join('&')
          }
          const addressRes: any = await fetch('https://www.zhipin.com/wapi/zpjob/job/lastManageAddress?' + getParams({ _: new Date().getTime() })).then((response) => response.json())
          data.relationIdJson = addressRes.zpData?.manageJobPoi.relationIdJson
          if (!data.relationIdJson) {
            return { state: false, msg: '发布招聘信息失败: 工作地址未创建' }
          }
          const res: any = await fetch('https://www.zhipin.com/wapi/zpjob/job/position/suggest?' + getParams({ jobName: data.positionName, jobType: '0', _: new Date().getTime() })).then((response) => response.json())
          const jobInfo = res.zpData
          if (!jobInfo || !jobInfo.code) {
            return { state: false, msg: '发布招聘信息失败: 该岗位在boss直聘未找到' }
          }
          data.position = jobInfo.code
          const resScheme: any = await fetch('https://www.zhipin.com/wapi/zpjob/scheme/info?' + getParams({ init: false, encJobId: "", position: "", jobType: 0, editFlag: "", _: new Date().getTime() })).then((response) => response.json())
          data.editFlag = resScheme.zpData?.extraInfo?.editFlag || ''
          const resData = await fetch('https://www.zhipin.com/wapi/zpjob/job/save?_=' + new Date().getTime(), {
            method: 'POST',
            headers: {
              'Connection': 'keep-alive',
              'content-type': 'application/x-www-form-urlencoded',
              'accept': 'application/json, text/plain, */*',
              'x-requested-with': 'XMLHttpRequest, XMLHttpRequest',
              'traceid': traceid.value,
              'zp_token': zp_token.value,
              'Sec-Fetch-Site': 'same-origin',
              'Sec-Fetch-Mode': 'cors',
              'sec-ch-ua-platform': "Windows",
              'Sec-Fetch-Dest': 'empty',
              'sec-ch-ua-mobile': '?0'
            },
            body: getParams(data)
          }).then((response) => response.json())
          if (resData.code === 0) {
            return { state: true, msg: resData.zpData.blockTitle }
          } else {
            return { state: false, msg: resData.message }
          }
        } catch (error: any) {
          return { state: false, msg: '发布招聘信息失败: ' + error.message }
        }
      },
      args: [jobData, zhipinRequestHeader]
    })
    if (!publishZhiPinResult[0].result.state) {
      publishing.value = false
      return ElMessage({ message: publishZhiPinResult[0].result.msg, type: 'error', duration: 6000 })
    }
  }
  ElMessage({ message: '发布招聘信息成功', type: 'success', duration: 6000 })
  await sleep(1500)
  await closeFrom()
}
</script>

<style scoped>
.form-page {
  background: #f7f8fa;
  min-height: 640px;
  height: 640px;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 头部 */
.plugin-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #5B7CF6 0%, #7B5CF6 100%);
  border-bottom: none;
}
.header-logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  object-fit: contain;
  flex-shrink: 0;
  background: rgba(255,255,255,0.2);
  padding: 4px;
}
.header-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.header-title {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
}
.header-sub {
  font-size: 11px;
  color: rgba(255,255,255,0.75);
  line-height: 1.3;
}

/* 表单区域 */
.form-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

/* 发布按钮 */
.btn-publish {
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
  margin-top: 8px;
}
.btn-publish:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(91,124,246,0.45);
}
.btn-publish:active:not(:disabled) {
  transform: translateY(0);
}
.btn-publish:disabled {
  background: linear-gradient(135deg, #c0c7e8 0%, #bdb8e8 100%);
  box-shadow: none;
  cursor: not-allowed;
}
.btn-icon {
  display: flex;
  align-items: center;
}
.spin-icon {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
