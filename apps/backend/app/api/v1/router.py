from fastapi import APIRouter

from app.api.v1.endpoints import health, prediction

router = APIRouter()

router.include_router(health.router, prefix="/health", tags=["health"])
router.include_router(prediction.router, prefix="/prediction", tags=["prediction"])
