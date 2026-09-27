import logging
from typing import Generator
import redis
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings
from app.models.db_models import Base

logger = logging.getLogger("smartdoc.database")

# Configure PostgreSQL SQLAlchemy connection pool
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_pre_ping=True,  # Proactively verify connection health before checkout
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Redis Cache Client Connection Pool
redis_client: redis.Redis = None

def get_redis_client() -> redis.Redis:
    global redis_client
    if redis_client is None:
        try:
            redis_client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=3
            )
            redis_client.ping()
            logger.info("Connected to Redis cache at %s", settings.REDIS_URL)
        except Exception as e:
            logger.warning("Redis initial connection failed (%s). Cache will operate in fallback mode.", e)
            redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return redis_client


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for yielding database session with automatic cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create database tables if they do not exist."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created successfully.")
    except Exception as e:
        logger.error("Database table initialization error: %s", e)
