"""AI助手修改训练方案服务"""

import json
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.action import Action
from app.models.training_plan import PlanDay, PlanExercise
from app.services.deepseek_service import chat_with_reasoning

logger = logging.getLogger(__name__)


async def modify_plan_with_ai(
    day: PlanDay,
    instruction: str,
    db: AsyncSession,
) -> tuple[bool, str, list[dict[str, Any]] | None]:
    """
    使用AI解析用户指令并修改训练方案

    Args:
        day: 要修改的训练日
        instruction: 用户的修改指令
        db: 数据库会话

    Returns:
        (success, message, modified_exercises)
        - success: 是否成功
        - message: 返回消息
        - modified_exercises: 修改后的动作列表（如果成功）
    """

    # 1. 获取当前方案的所有动作
    current_exercises = []
    for ex in sorted(day.exercises, key=lambda e: e.sort_order):
        current_exercises.append({
            "id": ex.id,
            "action_id": ex.action_id,
            "name": ex.name,
            "phase": ex.phase,
            "sets": ex.sets,
            "reps": ex.reps,
            "rest_seconds": ex.rest_seconds,
            "sort_order": ex.sort_order,
        })

    # 2. 获取所有可用动作（用于替换或添加）
    result = await db.execute(select(Action))
    all_actions = result.scalars().all()

    action_library = []
    for action in all_actions:
        action_library.append({
            "id": action.id,
            "name": action.name,
            "category": action.category,
            "difficulty": action.difficulty,
            "description": action.description,
        })

    # 3. 构建AI提示词
    prompt = f"""你是一个专业的训练方案调整助手。用户想要修改他们的训练方案。

**当前方案动作列表：**
{json.dumps(current_exercises, ensure_ascii=False, indent=2)}

**可用动作库：**
{json.dumps(action_library, ensure_ascii=False, indent=2)}

**用户指令：**
{instruction}

**任务：**
根据用户指令，修改当前方案。你可以：
1. 调整现有动作的组数、次数、休息时间
2. 从动作库中添加新动作
3. 删除某些动作
4. 调整动作顺序

**输出格式（必须是有效的JSON）：**
{{
  "success": true,
  "message": "修改说明（告诉用户做了什么改动）",
  "exercises": [
    {{
      "action_id": 动作库ID,
      "name": "动作名称",
      "phase": "warmup/core/stretch",
      "sets": 组数,
      "reps": 次数,
      "rest_seconds": 休息秒数,
      "sort_order": 排序（从0开始）
    }}
  ]
}}

**注意事项：**
1. phase必须是warmup、core或stretch之一
2. 热身动作(warmup)应该放在最前面
3. 拉伸动作(stretch)应该放在最后面
4. 核心训练(core)放在中间
5. sort_order必须从0开始连续递增
6. 如果用户指令不明确或无法执行，设置success为false并在message中说明原因
7. 只输出JSON，不要有任何其他文字

现在请根据用户指令修改方案："""

    try:
        # 4. 调用AI
        response = await chat_with_reasoning([{"role": "user", "content": prompt}])

        # 5. 解析AI响应
        # 移除可能的markdown代码块标记
        response = response.strip()
        if response.startswith("```json"):
            response = response[7:]
        if response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
        response = response.strip()

        result = json.loads(response)

        if not result.get("success"):
            return False, result.get("message", "无法执行该指令"), None

        # 6. 验证修改后的动作列表
        modified_exercises = result.get("exercises", [])
        if not modified_exercises:
            return False, "修改后的方案不能为空", None

        # 验证所有action_id存在
        action_ids = {ex["action_id"] for ex in modified_exercises}
        action_result = await db.execute(select(Action).where(Action.id.in_(action_ids)))
        actions = action_result.scalars().all()
        action_map = {act.id: act for act in actions}

        if len(action_map) != len(action_ids):
            return False, "部分动作不存在于动作库中", None

        # 7. 应用修改
        # 删除旧动作
        for ex in day.exercises:
            await db.delete(ex)

        # 创建新动作
        new_exercises = []
        for ex_data in modified_exercises:
            action = action_map[ex_data["action_id"]]
            new_ex = PlanExercise(
                plan_day_id=day.id,
                action_id=ex_data["action_id"],
                name=action.name,
                phase=ex_data["phase"],
                sets=ex_data["sets"],
                reps=ex_data["reps"],
                rest_seconds=ex_data["rest_seconds"],
                sort_order=ex_data["sort_order"],
            )
            db.add(new_ex)
            new_exercises.append({
                "id": None,  # 新创建的，还没有ID
                "action_id": new_ex.action_id,
                "name": new_ex.name,
                "phase": new_ex.phase,
                "sets": new_ex.sets,
                "reps": new_ex.reps,
                "rest_seconds": new_ex.rest_seconds,
                "sort_order": new_ex.sort_order,
            })

        # 更新训练日的预估时长
        total_duration = sum(
            ex["sets"] * (ex["reps"] * 2 + ex["rest_seconds"]) for ex in new_exercises
        ) // 60
        day.estimated_duration = max(1, total_duration)

        await db.commit()

        return True, result.get("message", "方案已成功修改"), new_exercises

    except json.JSONDecodeError as e:
        logger.error(f"AI响应JSON解析失败: {e}, 响应内容: {response}")
        return False, "AI响应格式错误，请重试", None
    except Exception as e:
        logger.error(f"AI修改方案失败: {e}")
        await db.rollback()
        return False, f"修改失败: {str(e)}", None
