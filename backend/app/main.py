from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, users, features, knowledge_base

# Tables are managed by Alembic migrations
# Run: cd backend && alembic upgrade head

app = FastAPI(title="Feature Request Dashboard")

# CORS - Allow all for now since we might run frontend separately
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(features.router, prefix="/features", tags=["features"])
app.include_router(knowledge_base.router, prefix="/knowledge-base", tags=["knowledge-base"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the Feature Request Dashboard API"}
