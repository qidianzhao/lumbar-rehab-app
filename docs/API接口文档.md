# 腰突康复运动App — API接口文档

**文档版本：** v1.3
**日期：** 2026年5月3日
**配套文档：** PRD v1.0、技术方案文档 v1.1、数据库设计文档 v1.1
**Base URL：** `http://192.168.5.119:8000/api/v1`（开发环境）
**认证方式：** Bearer Token（JWT）
**数据格式：** JSON
**更新说明：** v2.1架构重构 - 新增方案列表和AI修改方案接口

---

## 一、通用约定

### 1.1 请求头

```
Content-Type: application/json
Authorization: Bearer {access_token}    # 除登录注册外所有接口必带
```

### 1.2 统一响应格式

**成功响应：**
```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

**错误响应：**
```json
{
  "code": 40001,
  "message": "验证码已过期，请重新获取",
  "data": null
}
```

### 1.3 错误码定义

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 40001 | 参数错误 |
| 40002 | 验证码错误或已过期 |
| 40003 | 输入内容超长 |
| 40101 | 未登录/Token过期 |
| 40102 | Token无效 |
| 40301 | 无权限访问 |
| 40401 | 资源不存在 |
| 42901 | 请求过于频繁（限流） |
| 42902 | 今日免费对话次数已用完 |
| 50001 | 服务器内部错误 |
| 50002 | 第三方服务调用失败（大模型/TTS/ASR） |

### 1.4 分页参数

所有列表接口统一使用：
```
GET /xxx?page=1&page_size=20
```

分页响应：
```json
{
  "code": 0,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "page_size": 20,
    "total_pages": 5
  }
}
```

---

## 二、认证模块 `/auth`

### 2.1 发送验证码

```
POST /auth/send-code
```

**无需认证**

**请求体：**
```json
{
  "phone": "13800138000"
}
```

**成功响应：**
```json
{
  "code": 0,
  "message": "验证码已发送",
  "data": {
    "expire_seconds": 300
  }
}
```

**限流规则：** 同一手机号60秒内只能发送1次，同一IP每小时最多20次

---

### 2.2 验证码登录/注册

```
POST /auth/login
```

**无需认证**

**请求体（新用户首次登录=注册）：**
```json
{
  "phone": "13800138000",
  "code": "123456",
  "nickname": "腰突战士",
  "gender": "male",
  "age": 35
}
```

**请求体（老用户登录，无需nickname等字段）：**
```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

**成功响应：**
```json
{
  "code": 0,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "Bearer",
    "expires_in": 604800,
    "is_new_user": true,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "phone": "138****8000",
      "nickname": "腰突战士",
      "gender": "male",
      "age": 35,
      "avatar_url": null,
      "has_health_profile": false,
      "has_assessment": false,
      "has_active_plan": false
    }
  }
}
```

---

### 2.3 刷新Token

```
POST /auth/refresh
```

**无需认证（用refresh_token换新access_token）**

**请求体：**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**成功响应：**
```json
{
  "code": 0,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 604800
  }
}
```

---

## 三、用户模块 `/users`

### 3.1 获取当前用户信息

```
GET /users/me
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "550e8400-...",
    "phone": "138****8000",
    "nickname": "腰突战士",
    "gender": "male",
    "age": 35,
    "avatar_url": null,
    "show_in_leaderboard": true,
    "push_enabled": true,
    "training_remind_time": "19:00",
    "sedentary_remind_interval": 60,
    "has_health_profile": true,
    "has_assessment": true,
    "has_active_plan": true,
    "current_plan_id": "660e8400-...",
    "stats": {
      "total_training_days": 25,
      "consecutive_days": 7,
      "total_training_minutes": 450,
      "current_level": "INTERMEDIATE"
    }
  }
}
```

---

### 3.2 更新用户基本信息

```
PUT /users/me
```

**请求体（部分更新，只传需要改的字段）：**
```json
{
  "nickname": "核心战士",
  "age": 36,
  "show_in_leaderboard": false,
  "training_remind_time": "20:00",
  "sedentary_remind_interval": 0
}
```

---

### 3.3 获取运动档案

```
GET /users/me/health-profile
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "770e8400-...",
    "height": 175.0,
    "weight": 72.5,
    "disc_segments": ["L4_L5", "L5_S1"],
    "disc_severity": "PROTRUSION",
    "other_conditions": ["NONE"],
    "daily_sitting_hours": "H4_8",
    "exercise_habit": "OCCASIONAL",
    "is_complete": true,
    "updated_at": "2026-04-12T10:00:00Z"
  }
}
```

---

### 3.4 创建/更新运动档案

```
PUT /users/me/health-profile
```

**请求体：**
```json
{
  "height": 175.0,
  "weight": 72.5,
  "disc_segments": ["L4_L5", "L5_S1"],
  "disc_severity": "PROTRUSION",
  "other_conditions": ["NONE"],
  "daily_sitting_hours": "H4_8",
  "exercise_habit": "OCCASIONAL"
}
```

**响应额外字段：**
```json
{
  "code": 0,
  "data": {
    "...": "...",
    "plan_regeneration_suggested": true,
    "message": "运动档案已更新。由于你修改了身体状况信息，建议重新生成训练计划。"
  }
}
```

---

## 四、动作库模块 `/actions`

### 4.1 获取动作列表

```
GET /actions
```

**响应：**
```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": 1,
      "name": "猫牛式",
      "phase": "warmup",
      "difficulty_level": 1,
      "description": null,
      "video_url": "http://192.168.5.119:8080/体能测试动作/male-Recovery-thoracic-flexion-and-extensions-mobility-front.mp4"
    }
  ]
}
```

`phase` 取值：`warmup`（热身）、`core`（核心）、`stretch`（拉伸）

视频 URL 由 `backend/video_mapping.json` 映射，视频服务器运行在 `http://192.168.5.119:8080`。

---

### 4.2 获取动作详情

```
GET /actions/{action_id}
```

**响应：** 同上单个动作字段（直接返回对象，无 code/data 包装）。

---

## 五、体能测试模块 `/assessment`

### 5.1 获取测试项目列表

```
GET /assessment/test-items
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "action_id": "ACT_PLANK_01",
        "action_name": "平板支撑",
        "dimension": "核心耐力",
        "metric_type": "DURATION",
        "metric_unit": "秒",
        "instruction": "保持标准平板支撑姿势，记录能坚持的时长",
        "video_url": "https://cdn.your-domain.com/videos/plank_01.mp4"
      }
    ],
    "total_items": 6,
    "estimated_duration_minutes": 15
  }
}
```

---

### 5.2 提交测试结果

```
POST /assessment/submit
```

**请求体：**
```json
{
  "items": [
    {
      "action_id": "ACT_PLANK_01",
      "dimension": "核心耐力",
      "metric_type": "DURATION",
      "metric_value": 45,
      "user_notes": "最后10秒有点抖"
    },
    {
      "action_id": "ACT_BRIDGE_01",
      "dimension": "臀部力量",
      "metric_type": "COUNT",
      "metric_value": 15,
      "user_notes": null
    }
  ]
}
```

**响应（AI评估结果）：**
```json
{
  "code": 0,
  "data": {
    "assessment_id": "880e8400-...",
    "overall_level": "BEGINNER",
    "scores": {
      "core_endurance": 40.0,
      "glute_strength": 55.0,
      "spinal_stability": 35.0,
      "core_control": 45.0,
      "spinal_mobility": 60.0,
      "flexibility": 50.0
    },
    "weak_areas": [
      {
        "dimension": "脊柱稳定性",
        "score": 35.0,
        "description": "鸟狗式保持不稳定，核心深层稳定肌力量不足",
        "target_muscles": ["多裂肌", "腹横肌"],
        "suggested_exercises": ["ACT_BIRDDOG_01", "ACT_DEADBUG_01"]
      }
    ],
    "ai_summary": "你的整体核心力量处于初级水平，臀部力量和柔韧性相对较好...",
    "suggested_plan_level": "BEGINNER",
    "created_at": "2026-04-12T10:30:00Z"
  }
}
```

---

### 5.3 获取历史测试记录

```
GET /assessment/history
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "assessment_id": "880e8400-...",
        "overall_level": "BEGINNER",
        "scores": { "...": "..." },
        "created_at": "2026-04-12T10:30:00Z"
      },
      {
        "assessment_id": "990e8400-...",
        "overall_level": "INTERMEDIATE",
        "scores": { "...": "..." },
        "created_at": "2026-05-25T10:30:00Z"
      }
    ]
  }
}
```

---

## 六、训练计划模块 `/plans`

### 6.1 生成训练计划（AI）

```
POST /plans/generate
```

**请求体：**
```json
{
  "plan_type": "MAIN",
  "assessment_id": "880e8400-...",
  "weekly_frequency": 4,
  "preferred_duration_minutes": 25,
  "user_notes": "希望多加一些臀部力量的训练"
}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "plan_id": "aa0e8400-...",
    "title": "初级核心强化计划",
    "level": "BEGINNER",
    "description": "为期6周的初级核心训练计划，重点加强脊柱稳定性和臀部力量...",
    "weekly_frequency": 4,
    "estimated_weeks": 6,
    "status": "DRAFT",
    "weeks": [
      {
        "week_number": 1,
        "days": [
          {
            "plan_day_id": "bb0e8400-...",
            "day_number": 1,
            "day_type": "TRAINING",
            "title": "核心基础训练 A",
            "estimated_duration": 25,
            "phases": {
              "warmup": [
                {
                  "action_id": "ACT_CATCOW_01",
                  "action_name": "猫牛式",
                  "sets": 2,
                  "reps": "8次",
                  "rest_seconds": 15,
                  "coaching_notes": "配合呼吸，吸气抬头塌腰，呼气低头弓背"
                }
              ],
              "core": [
                {
                  "action_id": "ACT_BRIDGE_01",
                  "action_name": "臀桥",
                  "sets": 3,
                  "reps": "12次",
                  "rest_seconds": 30,
                  "coaching_notes": "臀部发力上抬，顶端停留2秒再缓慢下放"
                }
              ],
              "stretch": [
                {
                  "action_id": "ACT_CHILDPOSE_01",
                  "action_name": "婴儿式",
                  "sets": 1,
                  "reps": "30秒",
                  "rest_seconds": 0,
                  "coaching_notes": "放松呼吸，感受腰背部的拉伸"
                }
              ]
            }
          },
          {
            "day_number": 2,
            "day_type": "REST"
          }
        ]
      }
    ]
  }
}
```

---

### 6.2 确认计划（开始执行）

```
POST /plans/{plan_id}/confirm
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "plan_id": "aa0e8400-...",
    "status": "ACTIVE",
    "message": "计划已确认，从今天开始执行！加油！"
  }
}
```

---

### 6.3 获取当前计划

```
GET /plans/current
```

**响应：** 同6.1响应格式，额外包含进度信息：
```json
{
  "progress_week": 2,
  "progress_day": 3,
  "total_completed_sessions": 7,
  "today_plan_day": {
    "plan_day_id": "bb0e8400-...",
    "title": "核心基础训练 B",
    "is_completed_today": false,
    "phases": { "...": "..." }
  }
}
```

---

### 6.4 获取计划列表（历史）

```
GET /plans?status=COMPLETED&page=1&page_size=10
```

---

### 6.5 放弃/回退计划

```
POST /plans/{plan_id}/abandon
```

```
POST /plans/{plan_id}/downgrade
```

**回退响应：**
```json
{
  "code": 0,
  "data": {
    "old_level": "INTERMEDIATE",
    "new_level": "BEGINNER",
    "new_plan_id": "cc0e8400-...",
    "message": "已为你生成新的初级计划，之前的训练记录已保留。"
  }
}
```

---

### 6.6 获取我的方案列表 **[v2.1新增]**

```
GET /plans/?plan_type={plan_type}
```

**查询参数：**
- `plan_type` (可选): 方案类型筛选，可选值：`training`(训练)、`stretch`(拉伸)、`eye_exercise`(眼保健操)

**响应：**
```json
{
  "code": 0,
  "data": [
    {
      "id": "aa0e8400-...",
      "title": "核心强化训练方案",
      "plan_type": "training",
      "level": "BEGINNER",
      "duration_minutes": 25,
      "status": "ACTIVE",
      "action_count": 8,
      "created_at": "2026-05-03T10:00:00Z",
      "updated_at": "2026-05-03T10:00:00Z"
    },
    {
      "id": "bb0e8400-...",
      "title": "办公室拉伸方案",
      "plan_type": "stretch",
      "level": "BEGINNER",
      "duration_minutes": 10,
      "status": "ACTIVE",
      "action_count": 5,
      "created_at": "2026-05-03T11:00:00Z",
      "updated_at": "2026-05-03T11:00:00Z"
    }
  ]
}
```

---

### 6.7 AI修改方案 **[v2.1新增]**

```
POST /plans/{plan_id}/days/{day_id}/ai-modify
```

**请求体：**
```json
{
  "instruction": "增加核心训练强度，把平板支撑改为4组"
}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "success": true,
    "message": "已根据你的要求修改方案",
    "changes": [
      {
        "type": "update",
        "action_name": "平板支撑",
        "field": "sets",
        "old_value": 3,
        "new_value": 4
      }
    ],
    "updated_exercises": [
      {
        "id": "ex001",
        "action_id": "ACT_PLANK_01",
        "action_name": "平板支撑",
        "sets": 4,
        "reps": "30秒",
        "rest_seconds": 30,
        "phase": "core",
        "sort_order": 1
      }
    ]
  }
}
```

**支持的自然语言指令示例：**
- "增加核心训练强度"
- "减少拉伸时间"
- "添加平板支撑动作"
- "把第一个动作的组数改为4组"
- "删除所有热身动作"
- "把臀桥的休息时间改为45秒"

**错误响应：**
```json
{
  "code": 400,
  "message": "无法理解你的指令，请尝试更具体的描述"
}
```

---

## 七、训练会话模块 `/training`

### 7.1 创建训练会话（开始训练）

```
POST /training/sessions
```

**请求体：**
```json
{
  "plan_id": "aa0e8400-...",
  "plan_day_id": "bb0e8400-...",
  "pre_check_status": "NORMAL"
}
```

**如果状态为DISCOMFORT，需携带不适信息：**
```json
{
  "plan_id": "aa0e8400-...",
  "plan_day_id": "bb0e8400-...",
  "pre_check_status": "DISCOMFORT",
  "pain_info": {
    "pain_location": "腰部左侧",
    "pain_level": 4,
    "description": "久坐后腰部酸胀",
    "action_taken": "LIGHT_TRAINING"
  }
}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "session_id": "dd0e8400-...",
    "status": "IN_PROGRESS",
    "today_course": {
      "title": "核心基础训练 A",
      "estimated_duration": 25,
      "total_actions": 8,
      "phases": { "...同计划中的phases格式..." }
    }
  }
}
```

---

### 7.2 提交动作完成记录

```
POST /training/sessions/{session_id}/records
```

**请求体（每完成一个动作提交一次）：**
```json
{
  "action_id": "ACT_BRIDGE_01",
  "phase": "CORE",
  "planned_sets": 3,
  "planned_reps": "12次",
  "actual_sets": 3,
  "actual_reps": "10次",
  "is_completed": true,
  "is_skipped": false,
  "difficulty_feedback": 3,
  "user_notes": null,
  "pain_reported": false
}
```

---

### 7.3 结束训练会话

```
POST /training/sessions/{session_id}/finish
```

**响应（训练报告）：**
```json
{
  "code": 0,
  "data": {
    "session_id": "dd0e8400-...",
    "status": "COMPLETED",
    "report": {
      "date": "2026-04-12",
      "duration_seconds": 1500,
      "duration_display": "25分钟",
      "total_actions": 8,
      "completed_actions": 7,
      "skipped_actions": 1,
      "completion_rate": 87.5,
      "pre_check_status": "NORMAL",
      "action_details": [
        {
          "action_name": "臀桥",
          "planned": "3组 × 12次",
          "actual": "3组 × 10次",
          "is_completed": true,
          "difficulty_feedback": 3
        }
      ],
      "ai_summary": "今天的训练完成得不错！臀桥比上次多做了2个，继续保持...",
      "comparison_with_last": {
        "bridge_reps_change": "+2",
        "plank_duration_change": "+5秒"
      },
      "next_training_preview": "明天是休息日，后天将进行核心基础训练 B"
    },
    "checkin": {
      "checkin_id": "ee0e8400-...",
      "consecutive_days": 8,
      "total_days": 26
    }
  }
}
```

---

### 7.4 获取训练历史

```
GET /training/sessions?start_date=2026-04-01&end_date=2026-04-12&page=1&page_size=20
```

---

### 7.5 获取阶段报告

```
GET /training/reports/phase?plan_id=aa0e8400-...
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "plan_title": "初级核心强化计划",
    "level": "BEGINNER",
    "period": "2026-03-15 ~ 2026-04-12",
    "total_training_days": 16,
    "total_duration_minutes": 400,
    "average_completion_rate": 85.5,
    "consecutive_days_max": 12,
    "action_progress": [
      {
        "action_name": "平板支撑",
        "first_record": "30秒",
        "latest_record": "55秒",
        "improvement": "+25秒"
      }
    ],
    "pain_log_summary": {
      "total_logs": 3,
      "average_pain_level": 3.2,
      "trend": "DECREASING"
    },
    "assessment_comparison": {
      "before": { "core_endurance": 40, "...": "..." },
      "after": { "core_endurance": 62, "...": "..." }
    },
    "ai_evaluation": "经过4周的初级训练，你的核心耐力提升了55%...",
    "milestones": [
      "平板支撑从30秒提升到55秒",
      "连续打卡12天",
      "臀桥从10次提升到15次"
    ],
    "next_phase_suggestion": "建议进行中级体能测试，评估是否可以进入中级训练阶段"
  }
}
```

---

### 7.6 获取周报告

```
GET /training/reports/weekly?year=2026&week=15
```

**响应格式同阶段报告，统计范围为一周。**

---

## 八、AI互动模块 `/ai`

### 8.1 训练中AI对话

```
POST /ai/chat
```

**请求体：**
```json
{
  "messages": [
    { "role": "user", "content": "做了10个" }
  ],
  "context": {
    "action_name": "臀桥",
    "current_set": 2,
    "total_sets": 3,
    "phase": "core"
  }
}
```

**响应：**
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "reply": "10个不错！休息30秒，准备第3组。"
  }
}
```

模型：`deepseek-chat`（快速响应，适合训练中实时互动）

**说明：** 训练中对话不限制次数，但会记录token用量用于统计。

---

### 8.2 自由问答（非训练时段）

```
POST /ai/free-chat
```

**请求体：**
```json
{
  "messages": [
    { "role": "user", "content": "平板支撑的时候腰总是塌下去怎么办？" }
  ]
}
```

**响应：**
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "reply": "平板支撑塌腰通常是核心力量不足..."
  }
}
```

模型：`deepseek-chat`

**限制：** 每用户每日15次免费对话，超出后返回429错误。单次输入最多200字符。

---

### 8.3 获取今日免费对话剩余次数

```
GET /ai/usage-limit
```

**响应：**
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "allowed": true,
    "used": 8,
    "limit": 15,
    "remaining": 7
  }
}
```

**字段说明：**
- `allowed`: 是否还可以继续对话
- `used`: 今日已使用次数
- `limit`: 每日限制次数
- `remaining`: 今日剩余次数

---

### 8.4 获取用户AI用量统计

```
GET /ai/usage-stats?days=7
```

**查询参数：**
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| days | int | 否 | 7 | 统计最近N天的数据 |

**响应：**
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "total_calls": 45,
    "total_input_tokens": 12500,
    "total_output_tokens": 8300,
    "by_type": {
      "free_chat": 12,
      "training_chat": 28,
      "assessment": 3,
      "plan_generation": 2
    },
    "daily": [
      { "date": "2026-04-25", "count": 5 },
      { "date": "2026-04-26", "count": 8 },
      { "date": "2026-04-27", "count": 6 },
      { "date": "2026-04-28", "count": 7 },
      { "date": "2026-04-29", "count": 9 },
      { "date": "2026-04-30", "count": 6 },
      { "date": "2026-05-01", "count": 4 }
    ]
  }
}
```

**字段说明：**
- `total_calls`: 总调用次数
- `total_input_tokens`: 总输入token数（包含系统提示词）
- `total_output_tokens`: 总输出token数
- `by_type`: 按用途分类的调用次数统计
- `daily`: 每日调用次数明细

**Token计算说明：** 采用字符数×2的简化估算（1个中文字符≈2个token），输入token包含系统提示词以反映真实API成本。

---

### 8.5 语音合成（TTS）

```
POST /voice/tts
```

**请求体：**
```json
{
  "text": "接下来是臀桥，注意双脚踩实地面"
}
```

**响应：** 直接返回 MP3 音频流（`Content-Type: audio/mpeg`），最大500字。

发音人：讯飞 `xiaoyan`（女声）

---

### 8.6 语音识别（ASR）

```
POST /voice/asr
```

**请求体：** `multipart/form-data`
| 字段 | 类型 | 说明 |
|------|------|------|
| audio | file | 音频文件（m4a/wav，前端录音格式） |

后端自动用 ffmpeg 将 m4a 转为 16kHz 单声道 PCM 后发给讯飞。

**响应：**
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "text": "做了十个"
  }
}
```

---
  }
}
```

注：也可以使用WebSocket实时流式识别。WebSocket接口地址：`wss://api.your-domain.com/v1/ai/asr/stream`

---

## 九、打卡与排行榜模块 `/checkin`

### 9.1 获取打卡日历

```
GET /checkin/calendar?year=2026&month=4
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "year": 2026,
    "month": 4,
    "consecutive_days": 8,
    "total_days": 26,
    "days": [
      { "date": "2026-04-01", "status": "CHECKED", "session_id": "dd0e8400-..." },
      { "date": "2026-04-02", "status": "REST" },
      { "date": "2026-04-03", "status": "CHECKED", "session_id": "dd1e8400-..." },
      { "date": "2026-04-04", "status": "MISSED" },
      { "date": "2026-04-12", "status": "TODAY_PENDING" }
    ]
  }
}
```

`status`值：`CHECKED`（已打卡）、`REST`（休息日）、`MISSED`（错过，非休息日未训练）、`DISCOMFORT_REST`（因不适休息，不计中断）、`TODAY_PENDING`（今天还没训练）、`FUTURE`（未来日期）

---

### 9.2 获取排行榜

```
GET /checkin/leaderboard?period=WEEK
```

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| period | string | 是 | WEEK / MONTH / YEAR |

**响应：**
```json
{
  "code": 0,
  "data": {
    "period": "WEEK",
    "period_label": "2026年第15周",
    "rankings": [
      {
        "rank": 1,
        "nickname": "核心王者",
        "training_days": 6,
        "consecutive_days": 15
      },
      {
        "rank": 2,
        "nickname": "腰突战士",
        "training_days": 5,
        "consecutive_days": 8
      }
    ],
    "my_ranking": {
      "rank": 2,
      "training_days": 5,
      "consecutive_days": 8
    },
    "total_participants": 56
  }
}
```

---

## 十、数据导出模块 `/export`

### 10.1 导出PDF报告

```
POST /export/pdf
```

**请求体：**
```json
{
  "start_date": "2026-03-01",
  "end_date": "2026-04-12",
  "include_sections": ["profile", "training_summary", "pain_logs", "assessment_comparison"]
}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "pdf_url": "https://oss.your-domain.com/exports/report_550e8400_20260412.pdf",
    "expires_at": "2026-04-19T00:00:00Z",
    "file_size_kb": 256
  }
}
```

---

## 十一、社交分享模块 `/share`

### 11.1 生成分享卡片

```
POST /share/card
```

**请求体：**
```json
{
  "card_type": "TRAINING_REPORT",
  "session_id": "dd0e8400-...",
  "show_nickname": true
}
```

`card_type`值：`TRAINING_REPORT`（单次训练报告）、`CHECKIN`（打卡记录）、`PHASE_REPORT`（阶段报告）、`PLAN_OVERVIEW`（训练计划概览）

**响应：**
```json
{
  "code": 0,
  "data": {
    "image_url": "https://oss.your-domain.com/share-cards/card_dd0e8400_20260412.png",
    "width": 1080,
    "height": 1920,
    "expires_at": "2026-04-19T00:00:00Z"
  }
}
```

---

## 十二、不适记录模块 `/pain-logs`

### 12.1 获取不适记录列表

```
GET /pain-logs?start_date=2026-03-01&end_date=2026-04-12
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "ff0e8400-...",
        "pain_location": "腰部左侧",
        "pain_level": 4,
        "description": "久坐后酸胀",
        "action_taken": "LIGHT_TRAINING",
        "log_date": "2026-04-10",
        "created_at": "2026-04-10T18:30:00Z"
      }
    ],
    "summary": {
      "total_logs": 5,
      "average_pain_level": 3.4,
      "trend": "STABLE",
      "most_common_location": "腰部左侧"
    }
  }
}
```

---

## 十三、数据同步模块 `/sync`

### 13.1 批量上传离线数据

```
POST /sync/upload
```

**请求体：**
```json
{
  "training_sessions": [
    {
      "local_id": "local_001",
      "plan_id": "aa0e8400-...",
      "plan_day_id": "bb0e8400-...",
      "pre_check_status": "NORMAL",
      "started_at": "2026-04-11T19:00:00+08:00",
      "ended_at": "2026-04-11T19:25:00+08:00",
      "records": [
        {
          "action_id": "ACT_BRIDGE_01",
          "phase": "CORE",
          "planned_sets": 3,
          "actual_sets": 3,
          "planned_reps": "12次",
          "actual_reps": "12次",
          "is_completed": true,
          "difficulty_feedback": 2
        }
      ]
    }
  ],
  "checkins": [
    {
      "local_id": "local_c001",
      "checkin_date": "2026-04-11",
      "local_session_id": "local_001"
    }
  ],
  "pain_logs": []
}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "synced_sessions": [
      { "local_id": "local_001", "server_id": "dd0e8400-..." }
    ],
    "synced_checkins": [
      { "local_id": "local_c001", "server_id": "ee0e8400-..." }
    ],
    "synced_pain_logs": [],
    "errors": []
  }
}
```

---

### 13.2 拉取最新数据

```
GET /sync/pull?last_sync_at=2026-04-10T00:00:00Z
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "actions_updated": [],
    "current_plan": { "...": "..." },
    "server_time": "2026-04-12T12:00:00Z"
  }
}
```

---

## 十四、接口限流规则总览

| 接口类型 | 限流规则 |
|---------|---------|
| 发送验证码 | 同一手机号60秒1次，同一IP每小时20次 |
| 登录 | 同一手机号5分钟内5次 |
| AI自由对话 | 每用户每日15次 |
| AI训练对话 | 训练session内不额外限制 |
| 训练计划生成 | 每用户每小时3次 |
| PDF导出 | 每用户每天5次 |
| 分享卡片生成 | 每用户每天20次 |
| 通用接口 | 每用户每分钟60次 |

---

## 十五、文档变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v1.0 | 2026-04-12 | 初始版本，覆盖全部MVP接口 |
| v1.1 | 2026-04-27 | 更新视频服务器IP配置 |
| v1.2 | 2026-05-01 | 新增AI用量统计接口（M11功能） |
