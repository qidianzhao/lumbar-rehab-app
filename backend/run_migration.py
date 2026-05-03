"""运行数据库迁移脚本"""
import asyncio
import sys
from pathlib import Path

from sqlalchemy import text
from app.database import engine


async def run_migration(sql_file: str):
    """执行SQL迁移文件"""
    sql_path = Path(__file__).parent / "migrations" / sql_file

    if not sql_path.exists():
        print(f"错误: 迁移文件不存在: {sql_path}")
        sys.exit(1)

    sql_content = sql_path.read_text(encoding="utf-8")

    print(f"执行迁移: {sql_file}")
    print("-" * 60)

    async with engine.begin() as conn:
        await conn.execute(text(sql_content))

    print("迁移执行成功!")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python run_migration.py <migration_file.sql>")
        sys.exit(1)

    migration_file = sys.argv[1]
    asyncio.run(run_migration(migration_file))
