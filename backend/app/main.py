from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.config import get_settings

FRONTEND_DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Backend API for the AI Stock Analysis panel.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_prefix)

    if FRONTEND_DIST_DIR.exists():
        assets_dir = FRONTEND_DIST_DIR / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/favicon.svg", include_in_schema=False)
        async def favicon() -> FileResponse:
            favicon_path = FRONTEND_DIST_DIR / "favicon.svg"
            if not favicon_path.exists():
                raise HTTPException(status_code=404, detail="Not Found")
            return FileResponse(favicon_path)

        @app.get("/icons.svg", include_in_schema=False)
        async def icons() -> FileResponse:
            icons_path = FRONTEND_DIST_DIR / "icons.svg"
            if not icons_path.exists():
                raise HTTPException(status_code=404, detail="Not Found")
            return FileResponse(icons_path)

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_frontend(full_path: str) -> FileResponse:
            if full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not Found")

            requested_path = FRONTEND_DIST_DIR / full_path
            if full_path and requested_path.is_file():
                return FileResponse(requested_path)

            index_path = FRONTEND_DIST_DIR / "index.html"
            if not index_path.exists():
                raise HTTPException(status_code=404, detail="Not Found")
            return FileResponse(index_path)
    else:
        @app.get("/", tags=["meta"])
        async def read_root() -> dict[str, str]:
            return {
                "name": settings.app_name,
                "environment": settings.app_env,
                "docs_url": "/docs",
            }

    return app


app = create_app()
