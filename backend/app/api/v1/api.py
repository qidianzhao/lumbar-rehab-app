from fastapi import APIRouter

from app.api.v1.endpoints import actions, ai, assessment, checkin, export, plans, share, training, users, voice

api_router = APIRouter()
api_router.include_router(actions.router, prefix="/actions", tags=["动作库"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI对话"])
api_router.include_router(voice.router, prefix="/voice", tags=["语音服务"])
api_router.include_router(plans.router, prefix="/plans", tags=["训练计划"])
api_router.include_router(assessment.router, prefix="/assessment", tags=["体能测试与评估"])
api_router.include_router(training.router, prefix="/training", tags=["训练执行"])
api_router.include_router(checkin.router, prefix="/checkin", tags=["打卡记录"])
api_router.include_router(users.router, prefix="/users", tags=["用户"])
api_router.include_router(export.router, prefix="/export", tags=["数据导出"])
api_router.include_router(share.router, prefix="/share", tags=["社交分享"])
