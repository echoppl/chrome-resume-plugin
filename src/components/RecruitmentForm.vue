<template>
  <el-form :model="formData" :rules="rules" size="small" ref="formRef" label-width="120px">
    <!-- <el-form-item label="招聘类型" prop="recruitmentType">
      <el-select v-model="formData.recruitmentType" placeholder="请选择招聘类型">
        <el-option label="全职" value="全职" />
        <el-option label="兼职" value="兼职" />
        <el-option label="实习" value="实习" />
      </el-select>
    </el-form-item> -->
    <el-form-item label="职位名称" prop="positionName">
      <el-input v-model="formData.positionName" placeholder="请输入职位名称" />
    </el-form-item>
    <el-form-item label="职位职责" prop="responsibilities">
      <el-input
        v-model="formData.responsibilities"
        type="textarea"
        :rows="10"
        placeholder="请输入职位职责"
      />
    </el-form-item>
    <el-form-item label="岗位描述" prop="requirementsText">
      <el-input
        v-model="formData.requirementsText"
        type="textarea"
        :rows="10"
        placeholder="请输入岗位描述"
      />
    </el-form-item>
    <el-form-item label="工作经验" prop="workExperience">
      <el-input v-model="formData.workExperience" placeholder="请输入职位名称" />
    </el-form-item>

    <el-form-item label="学历要求" prop="educationRequirement">
      <el-select v-model="formData.educationRequirement" placeholder="请选择学历要求">
        <el-option label="大专" value="大专" />
        <el-option label="本科" value="本科" />
        <el-option label="硕士" value="硕士" />
        <el-option label="博士" value="博士" />
      </el-select>
    </el-form-item>

    <el-form-item label="薪资范围" prop="salaryRange">
      <div style="display: flex;gap: 10px;">
        <el-input v-model="formData.lowSalary" style="width: 100px;" placeholder="输入数字">
          <template #suffix>k</template>
        </el-input>
        -
        <el-input v-model="formData.highSalary" style="width: 100px;" placeholder="输入数字">
          <template #suffix>k</template>
        </el-input>
        ×
        <el-input v-model="formData.salaryMonth" style="width: 100px;" placeholder="输入数字">
          <template #suffix>月</template>
        </el-input>
      </div>
    </el-form-item>

    <el-form-item label="招聘人数" prop="recruitmentCount">
      <el-input-number v-model="formData.recruitmentCount" :min="1" :max="100" />
    </el-form-item>

    <!-- <el-form-item label="工作地址" prop="workAddress">
      <el-input v-model="formData.workAddress" placeholder="请输入工作地址" />
    </el-form-item> -->
<!-- 
    <el-form-item label="行业要求" prop="industryRequirement">
      <el-input v-model="formData.industryRequirement" placeholder="请输入行业要求" />
    </el-form-item>

    <el-form-item label="截止日期" prop="deadline">
      <el-date-picker
        v-model="formData.deadline"
        type="date"
        placeholder="请选择截止日期"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
      />
    </el-form-item> -->
    <el-form-item label="发布平台" prop="publishPlatform">
      <el-checkbox-group v-model="formData.publishPlatform" placeholder="请选择发布平台">
        <el-checkbox label="猎聘网" value="猎聘网" />
        <el-checkbox label="boss直聘" value="boss直聘" />
      </el-checkbox-group>
    </el-form-item>
    <el-form-item>
      <slot></slot>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'

const formRef = ref<FormInstance>()
const formData = ref({
  recruitmentType: '全职',
  positionName: '',
  positionCategory: '',
  positionDescription: '',
  workExperience: '',
  educationRequirement: '',
  salaryRange: '',
  recruitmentCount: 1,
  workAddress: '',
  industryRequirement: '',
  requirementsText: '',
  responsibilities: '',
  lowSalary: '10',
  highSalary: '12',
  salaryMonth: '12',
  publishPlatform: [],
  deadline: ''
})
const validateSalaryRange = (rule: any, value: any, callback: any) => {
  const {salaryMonth, highSalary, lowSalary} = formData.value
  if (!salaryMonth || !highSalary || !lowSalary) return callback(new Error('请输入薪资范围'))
  if (Number(lowSalary) > Number(highSalary)) return callback(new Error('薪资范围不能为低薪资大于高薪资'))
  if (Number(salaryMonth) < 1) return callback(new Error('月数不能小于1月'))
  callback()
}
const rules = reactive<FormRules>({
  positionName: [{ required: true, message: '请输入职位名称', trigger: 'blur' }],
  responsibilities: [{ required: true, message: '请输入职位职责', trigger: 'blur' }],
  requirementsText: [{ required: true, message: '请输入岗位描述', trigger: 'blur' }],
  workExperience: [{ required: true, message: '请输入工作经验', trigger: 'blur' }],
  educationRequirement: [{ required: true, message: '请选择学历要求', trigger: 'change' }],
  recruitmentCount: [{ required: true, message: '请输入招聘人数', trigger: 'blur' }],
  publishPlatform: [{ required: true, message: '请选择发布平台', trigger: 'change' }],
  salaryRange: [{ validator: validateSalaryRange, trigger: 'blur', required: true }]
})

const emit = defineEmits<{
  export: [data: typeof formData.value]
}>()

const exportData = async (): Promise<typeof formData.value | null> => {
  if (!formRef.value) return null
  try {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return null
    emit('export', formData.value)
    return formData.value
  } catch {
    return null
  }
}

const resetForm = () => {
  if (!formRef.value) return
  formRef.value.resetFields()
}

const setData = (data:any) => {
  formData.value = {...formData.value, ...data}
  formData.value.educationRequirement = data.educationReq.slice(0, 2)
  formData.value.recruitmentCount = data.demandCount
  formData.value.workExperience = data.experienceReq
}

defineExpose({
  exportData,
  setData,
  resetForm
})
</script>

<style scoped>
</style>