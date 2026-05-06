# 更新日志

## [v2.1] - 2026-05-03

### 🎯 架构重构：方案页面重构

**核心变更**：将训练方案系统从"长期训练计划"重构为"单次训练方案"，更符合腰突人群需要频繁起身活动的使用场景。

### ✨ 新增功能

#### 数据库层
- **Action模型**
  - 新增 `category` 字段：core(核心训练) | stretch(拉伸放松) | eye(眼部保健) | warmup(热身准备)
  - 新增 `thumbnail_url` 字段：动作缩略图URL
  - 新增索引：`idx_actions_category`

- **TrainingPlan模型**
  - 新增 `plan_type` 字段：training(训练) | stretch(拉伸) | eye_exercise(眼保健操)
  - 新增 `duration_minutes` 字段：单次方案预计时长
  - 新增索引：`idx_training_plans_plan_type`
  - 保留 `weekly_frequency` 和 `estimated_weeks` 字段以兼容旧数据

#### 后端API
- **GET /api/v1/plans/** - 获取方案列表，支持按 `plan_type` 筛选
- **POST /api/v1/plans/{plan_id}/days/{day_id}/ai-modify** - AI修改方案
  - 使用DeepSeek推理模型解析自然语言指令
  - 支持增删改动作、调整参数（组数、次数、休息时间）
  - 自动验证动作库ID和参数合法性
  - 自动更新训练时长
  - 记录AI用量

#### 前端页面
- **方案列表页面** (`frontend/app/(tabs)/program.tsx`)
  - 移除训练记录和本周日历
  - 新增方案类型Tab切换（训练/拉伸/眼保健操）
  - 方案卡片显示：动作数、时长、开始/编辑/AI优化按钮
  - 快捷操作：生成方案、动作库、AI助手

- **方案编辑页面** (`frontend/app/plan/[id]/edit-day/[dayId].tsx`)
  - 紧凑布局：动作名 + 热身标记同行，参数一行显示
  - 新增AI助手区域（可展开/收起）
  - 多行文本输入框支持自然语言指令
  - 应用修改按钮带加载状态

- **动作库页面** (`frontend/app/actions/index.tsx`)
  - 按分类展示：核心训练、拉伸放松、眼部保健、热身准备
  - 每个分类显示4个动作缩略图
  - 支持"更多"按钮（待实现详情页）

### 🐛 Bug修复
- 修复 `backend/app/models/__init__.py` 导入错误
  - 将不存在的 `TrainingSessionAction` 改为 `TrainingRecord`
  - 新增 `PainLog` 导入
  - 导出 `PlanType` 和 `ActionCategory` 枚举

### 📝 文档更新
- 更新 `docs/业务逻辑优化文档.md` v2.1
- 更新 `docs/数据库设计文档.md` v1.1
- 更新 `docs/API接口文档.md` v1.3
- 新增 `REFACTOR_SUMMARY.md` - 详细重构总结

### 🔄 数据库迁移
- 执行迁移脚本：`backend/migrations/add_plan_type_and_action_category.sql`
- 13条SQL语句全部执行成功
- 所有现有数据已自动设置默认值

### 🎨 架构变化

**旧架构**：
```
TrainingPlan (长期计划，4-12周)
  └─ PlanDay (训练日，按周和天组织)
      └─ PlanExercise (动作)
```

**新架构**（向后兼容）：
```
TrainingPlan (单次方案，20-30分钟)
  ├─ plan_type: training | stretch | eye_exercise
  ├─ duration_minutes: 单次时长
  └─ PlanDay (保留兼容，现在通常只有1个day)
      └─ PlanExercise (动作)
```

### 📋 影响的问题
本次重构直接解决或改善了以下问题：
- **[313] 训练计划手动调整** - 通过AI助手实现自然语言修改方案 ✅
- **[203] trainingStore状态复杂** - 简化为单次方案，降低状态管理复杂度 ✅
- **信息架构问题** - 方案页面重构，清晰的分类和操作流程 ✅

### 🚀 部署说明
1. 数据库迁移已完成 ✅
2. 需要重启后端服务以加载新模型和API
3. 需要重新加载前端应用以应用UI更改

### 📌 待实现功能（P2优先级）
- [ ] 动作库详情页 - 点击"更多"查看完整分类
- [ ] 视频缩略图生成 - 为动作库生成或上传缩略图
- [ ] AI语音版 - 支持语音输入修改指令
- [ ] 久坐提醒 - 定时推送拉伸方案通知
- [ ] 数据迁移脚本 - 将现有长期计划拆分为多个单次方案

---

## [v2.0] - 2026-05-02

### 用户测试完成
- 完成35个用户测试问题的记录和分类
- 识别信息架构问题，决定进行四页面架构重构

---

## [v1.0] - 2026-04-12

### 初始版本
- 完成基础功能开发
- 用户注册登录
- 健康档案管理
- 体能测试
- 训练计划生成
- 训练会话执行
- 打卡与排行榜
