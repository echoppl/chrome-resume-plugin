# docs/ 目录说明

> ⚠️ **本仓库是公开仓库，docs/ 目录里的内容会被所有人看到。**

## ✅ 适合放

- 公开产品的功能截图（UI 演示图）
- 通用开发文档（API 接口、技术方案）
- 公开域名引用（zhipin.com、liepin.com 等）
- 公开的产品文案/教程

## ❌ 严禁放

| 类型 | 例子 | 风险 |
|---|---|---|
| 候选人真实姓名/电话/邮箱 | 姓名、手机号、邮箱 | 个人隐私（GDPR/个保法） |
| 第三方平台的加密 ID | Boss 直聘的 `securityId`、`encryptGeekId`、`encryptResumeId` | 可关联真实候选人 |
| 内部业务系统域名 | `hrm-*.fcbox.com`、`hrm.fcbox.com` | 暴露公司内网结构 |
| 真实 API token / cookie | 任何 Bearer token、session cookie | 账号被盗 |
| 含候选人真实信息的截图 | 实际招聘页面截图（含有真实求职者） | 泄露候选人隐私 |
| 业务账号的密码 / 密钥 | 数据库密码、JWT secret | 系统被入侵 |

## 如何处理已有的敏感内容

如果你意外把这些内容 commit 了：

1. **立即** 不要直接 push（如果是本地修改）
2. 如果已经 push，**本地** `git rm <file>` + commit
3. **远程** 必须用 `git filter-branch --index-filter 'git rm --cached --ignore-unmatch <file>' -- --all` 重写历史
4. 然后 `git push --force` 覆盖远程
5. **警告**：clone 过仓库的其他人仍持有旧历史，无法远程消除

## 预防

- 提交前用 `git status` + `git diff --staged` 检查
- 含 URL/截图的内容先脱敏再提交
- 截图前先关闭真实数据标签页

## 历史教训

2026-09-04 曾因 `docs/使用指南.html`、`docs/xxxx.txt`、`docs/开发文档.md` 误传敏感内容
（候选人 PII、内部域名、加密 ID），通过 filter-branch 抹历史 + force push 修复，并保留本 README
防止再次发生。