from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import settings
from app.database import init_db
from app.routers import auth, users, queue
from app.services.websocket import router as ws_router
from app.services.matchmaking import matchmaking_service

# Configure logging - always DEBUG for development
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Make sure all loggers are at DEBUG level
logging.getLogger("app.services.websocket").setLevel(logging.DEBUG)
logging.getLogger("app.services.matchmaking").setLevel(logging.DEBUG)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("Starting up IELTS Speaking Partner API...")
    await init_db()
    
    # Start the matchmaking background task
    await matchmaking_service.start()
    logger.info("Matchmaking service started")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    await matchmaking_service.stop()


app = FastAPI(
    title=settings.app_name,
    description="IELTS Speaking Partner Platform - Practice speaking with real partners",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(queue.router, prefix="/queue", tags=["Queue"])
app.include_router(ws_router, tags=["WebSocket"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "message": "IELTS Speaking Partner API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Health check for deployment."""
    return {"status": "healthy"}
