from fastapi import APIRouter

from app.api.v1.endpoints import assessment, plans

api_router = APIRouter()
api_router.include_router(plans.router, prefix="/plans", tags=["训练计划"])
api_router.include_router(assessment.router, prefix="/assessment", tags=["体能测试与评估"])
