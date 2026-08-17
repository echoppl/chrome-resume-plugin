<template>
  <div>
    <div style="margin-bottom: 10px;">
      <el-button size="small" type="primary" @click="deleteSelectedRows">删除选中行</el-button>
      <el-button size="small" type="primary" @click="uploadSelectedRows">批量上传</el-button>
    </div>
    <el-table stripe border size="small" :data="tableData" :selection="selection" @selection-change="handleSelectionChange" style="width: 100%">
      <el-table-column type="selection" width="40" fixed="left" align="center" />
      <el-table-column prop="name" label="姓名" />
      <el-table-column prop="age" label="年龄" />
      <el-table-column prop="education" label="学历" />
      <el-table-column prop="address" label="地址" />
      <el-table-column prop="phone" label="手机号" />
      <el-table-column prop="email" label="邮箱" />
      <el-table-column prop="file" label="附件简历">
        <template #default="scope">
          <template v-if="scope.row.file">
            <el-button size="small" type="primary" text @click="openFile(scope.row)">预览</el-button>
          </template>
          <template v-else>无</template>
        </template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" width="140">
        <template #default="scope">
          <el-button size="small" type="primary" text @click="uploadResume(scope.row)">上传</el-button>
          <el-button size="small" type="primary" text @click="deleteRow(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const tableData = ref([])

const selection = ref([])

const openFile = (row: any) => {
  window.open(row.file)
}

const handleSelectionChange = (val: any) => {
  console.log(val)
  selection.value = val
}

const deleteSelectedRows = () => {
  tableData.value = tableData.value.filter((item) => !selection.value.find(i => JSON.stringify(i) === JSON.stringify(item)))
}

const uploadSelectedRows = () => {
  console.log(selection.value)
}

const uploadResume = (data: any) => {
  console.log(data)
}

const deleteRow = (row: any) => {
  tableData.value = tableData.value.filter((item) => item !== row)
}
</script>