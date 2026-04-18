from fastapi import APIRouter

from app.api.v1.endpoints import assessment, checkin, plans, training, users

api_router = APIRouter()
api_router.include_router(plans.router, prefix="/plans", tags=["训练计划"])
api_router.include_router(assessment.router, prefix="/assessment", tags=["体能测试与评估"])
api_router.include_router(training.router, prefix="/training", tags=["训练执行"])
api_router.include_router(checkin.router, prefix="/checkin", tags=["打卡记录"])
api_router.include_router(users.router, prefix="/users", tags=["用户"])
