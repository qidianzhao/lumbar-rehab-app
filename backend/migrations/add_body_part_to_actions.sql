-- 添加 body_part 列到 actions 表
ALTER TABLE actions ADD COLUMN IF NOT EXISTS body_part VARCHAR(32) NOT NULL DEFAULT 'back';

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_actions_body_part ON actions(body_part);

-- 更新现有数据，根据category设置合理的body_part默认值
UPDATE actions SET body_part = 'back' WHERE category = 'core' AND body_part = 'back';
UPDATE actions SET body_part = 'waist' WHERE category = 'stretch' AND body_part = 'back';
UPDATE actions SET body_part = 'neck' WHERE category = 'eye' AND body_part = 'back';
