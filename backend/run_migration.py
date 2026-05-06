"""运行数据库迁移脚本"""
import asyncio
import re
import sys
from pathlib import Path

from sqlalchemy import text
from app.database import engine


def split_sql_statements(sql_content: str) -> list[str]:
    """分割SQL语句，处理DO块和普通语句"""
    statements = []
    current = []
    in_do_block = False

    for line in sql_content.split('\n'):
        stripped = line.strip()

        # 跳过注释和空行
        if not stripped or stripped.startswith('--'):
            continue

        # 检测DO块开始
        if stripped.upper().startswith('DO $$'):
            in_do_block = True
            current.append(line)
            continue

        # 检测DO块结束
        if in_do_block and '$$;' in stripped:
            current.append(line)
            statements.append('\n'.join(current))
            current = []
            in_do_block = False
            continue

        # 在DO块内，继续累积
        if in_do_block:
            current.append(line)
            continue

        # 普通语句
        current.append(line)

        # 遇到分号结束语句
        if stripped.endswith(';'):
            statements.append('\n'.join(current))
            current = []

    # 处理最后一个语句
    if current:
        statements.append('\n'.join(current))

    return [s.strip() for s in statements if s.strip()]


async def run_migration(sql_file: str):
    """执行SQL迁移文件"""
    sql_path = Path(__file__).parent / "migrations" / sql_file

    if not sql_path.exists():
        print(f"错误: 迁移文件不存在: {sql_path}")
        sys.exit(1)

    sql_content = sql_path.read_text(encoding="utf-8")

    print(f"执行迁移: {sql_file}")
    print("-" * 60)

    # 分割SQL语句
    statements = split_sql_statements(sql_content)
    print(f"共 {len(statements)} 条SQL语句")

    async with engine.begin() as conn:
        for i, stmt in enumerate(statements, 1):
            try:
                print(f"[{i}/{len(statements)}] 执行中...")
                await conn.execute(text(stmt))
            except Exception as e:
                print(f"错误: 执行第 {i} 条语句失败")
                print(f"语句: {stmt[:100]}...")
                print(f"错误信息: {e}")
                raise

    print("迁移执行成功!")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python run_migration.py <migration_file.sql>")
        sys.exit(1)

    migration_file = sys.argv[1]
    asyncio.run(run_migration(migration_file))
