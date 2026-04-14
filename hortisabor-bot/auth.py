import os

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

BOT_API_KEY = os.environ.get('BOT_API_KEY', '')


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Validates Bearer token on all endpoints except /health.
    Disabled when BOT_API_KEY env var is empty (local dev)."""

    async def dispatch(self, request: Request, call_next):
        if not BOT_API_KEY:
            return await call_next(request)
        if request.url.path == '/health':
            return await call_next(request)
        if request.method == 'OPTIONS':
            return await call_next(request)

        auth = request.headers.get('Authorization', '')
        if auth != f'Bearer {BOT_API_KEY}':
            return JSONResponse(status_code=401, content={'detail': 'Unauthorized'})
        return await call_next(request)
