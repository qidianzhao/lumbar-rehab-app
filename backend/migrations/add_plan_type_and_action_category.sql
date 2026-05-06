-- 迁移：添加方案类型和动作分类字段
-- 日期：2025-01-XX
-- 描述：将TrainingPlan从长期计划改为单次方案，增加plan_type和duration_minutes字段
--       给Action表增加category和thumbnail_url字段

-- 1. 给actions表增加category和thumbnail_url字段
ALTER TABLE actions
ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'core',
ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(512);

-- 创建category索引
CREATE INDEX IF NOT EXISTS idx_actions_category ON actions(category);

-- 更新现有数据：根据phase字段设置category
UPDATE actions SET category = phase WHERE category = 'core';

-- 更新comment
COMMENT ON COLUMN actions.phase IS 'warmup | core | stretch (保留兼容性)';
COMMENT ON COLUMN actions.category IS '动作分类: core | stretch | eye | warmup';
COMMENT ON COLUMN actions.thumbnail_url IS '视频缩略图URL';

-- 2. 给training_plans表增加plan_type和duration_minutes字段
ALTER TABLE training_plans
ADD COLUMN IF NOT EXISTS plan_type VARCHAR(32) NOT NULL DEFAULT 'training',
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- 创建plan_type索引
CREATE INDEX IF NOT EXISTS idx_training_plans_plan_type ON training_plans(plan_type);

-- 更新comment
COMMENT ON COLUMN training_plans.plan_type IS '方案类型: training | stretch | eye_exercise';
COMMENT ON COLUMN training_plans.duration_minutes IS '单次方案预计时长（分钟）';

-- 3. 将weekly_frequency和estimated_weeks改为可选（兼容旧数据）
ALTER TABLE training_plans
ALTER COLUMN weekly_frequency SET DEFAULT 3,
ALTER COLUMN estimated_weeks SET DEFAULT 4;

-- 4. 迁移现有数据：计算单次方案时长
-- 对于有days的旧计划，取第一个training day的estimated_duration作为duration_minutes
UPDATE training_plans tp
SET duration_minutes = (
    SELECT pd.estimated_duration
    FROM plan_days pd
    WHERE pd.plan_id = tp.id
      AND pd.day_type = 'training'
    ORDER BY pd.week_number, pd.day_number
    LIMIT 1
)
WHERE tp.duration_minutes IS NULL;

-- 5. 输出迁移结果
DO $$
DECLARE
    action_count INTEGER;
    plan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO action_count FROM actions WHERE category IS NOT NULL;
    SELECT COUNT(*) INTO plan_count FROM training_plans WHERE plan_type IS NOT NULL;

    RAISE NOTICE '迁移完成:';
    RAISE NOTICE '- 已更新 % 个动作的分类字段', action_count;
    RAISE NOTICE '- 已更新 % 个方案的类型字段', plan_count;
END $$;
