from fastapi import APIRouter

from app.routers.auth import router as auth_router
from app.routers.analyses import router as analyses_router
from app.routers.health import router as health_router
from app.routers.stocks import router as stocks_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(health_router)
api_router.include_router(stocks_router)
api_router.include_router(analyses_router)
