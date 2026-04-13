"""动作库种子数据（仅当表为空时写入）。"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.action import Action

_DEFAULT_ROWS: list[dict[str, str | int]] = [
    # 热身
    {"name": "猫牛式", "phase": "warmup", "difficulty_level": 1},
    {"name": "骨盆后倾练习", "phase": "warmup", "difficulty_level": 1},
    {"name": "仰卧踝泵", "phase": "warmup", "difficulty_level": 1},
    {"name": "腹式呼吸激活", "phase": "warmup", "difficulty_level": 1},
    {"name": "侧卧蚌式热身", "phase": "warmup", "difficulty_level": 2},
    {"name": "跪姿髋环绕", "phase": "warmup", "difficulty_level": 2},
    # 核心
    {"name": "死虫式", "phase": "core", "difficulty_level": 1},
    {"name": "鸟狗式", "phase": "core", "difficulty_level": 1},
    {"name": "臀桥", "phase": "core", "difficulty_level": 1},
    {"name": "侧卧蚌式", "phase": "core", "difficulty_level": 1},
    {"name": "侧桥（膝支撑）", "phase": "core", "difficulty_level": 2},
    {"name": "平板支撑（膝落地）", "phase": "core", "difficulty_level": 2},
    {"name": "侧桥（足支撑）", "phase": "core", "difficulty_level": 3},
    {"name": "平板支撑", "phase": "core", "difficulty_level": 3},
    # 拉伸
    {"name": "仰卧抱膝拉伸", "phase": "stretch", "difficulty_level": 1},
    {"name": "腘绳肌拉伸", "phase": "stretch", "difficulty_level": 1},
    {"name": "梨状肌拉伸", "phase": "stretch", "difficulty_level": 1},
    {"name": "腰方肌侧弯拉伸", "phase": "stretch", "difficulty_level": 1},
    {"name": "胸腰椎旋转拉伸", "phase": "stretch", "difficulty_level": 2},
    {"name": "婴儿式放松", "phase": "stretch", "difficulty_level": 1},
    {"name": "坐位体前屈", "phase": "stretch", "difficulty_level": 1},
]


async def ensure_actions_seeded(session: AsyncSession) -> None:
    q = select(func.count()).select_from(Action)
    n = (await session.execute(q)).scalar_one()
    existing_names: set[str] = set()
    if n and int(n) > 0:
        rows = (await session.execute(select(Action.name))).scalars().all()
        existing_names = set(rows)

    for row in _DEFAULT_ROWS:
        name = str(row["name"])
        if name in existing_names:
            continue
        session.add(
            Action(
                name=name,
                phase=str(row["phase"]),
                difficulty_level=int(row["difficulty_level"]),
                description=None,
            )
        )
    await session.flush()
