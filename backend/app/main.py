from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.database import Base, engine
    import app.models.user  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("腰突康复运动App API 已启动")
    print("交互式文档地址: /docs (例如 http://127.0.0.1:8000/docs)")
    yield


app = FastAPI(title="腰突康复运动App API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
)

app.include_router(auth.router)


@app.get("/health")
def health():
    return {"status": "ok", "message": "服务运行正常"}


@app.get("/")
def root():
    return {"message": "腰突康复运动App API", "docs": "/docs"}