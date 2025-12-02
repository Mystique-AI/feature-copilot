# Feature Request Dashboard

## Overview
A Feature Request Tracking System with AI capabilities, built with FastAPI (Backend) and React (Frontend).

## Requirements
- Python 3.9+
- Node.js 18+
- PostgreSQL

## Setup

### Backend
1. Navigate to `backend/`
2. Create a virtual environment: `python -m venv venv`
3. Activate it: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Configure `.env.dev` file (copy from `.env.example`).
   - Set `DATABASE_URL`
   - Set `OPENAI_API_KEY` or `GENAI_API_KEY`
6. Run database migrations: `alembic upgrade head`
7. Run the server: `APP_ENV=dev uvicorn app.main:app --reload`

### Database Migrations
```bash
cd backend

# Create a new migration after model changes
alembic revision --autogenerate -m "description_of_change"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history
```

### Frontend
1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`

## Architecture
- **Backend**: FastAPI, SQLAlchemy, Pydantic
- **Frontend**: React, TailwindCSS, Vite
- **Database**: PostgreSQL
- **AI**: OpenAI GPT / Google GenAI (Configurable via env)

## Docker Deployment

### Quick Start
```bash
# 1. Copy and configure environment file
cp .env.example .env
# Edit .env with your settings (database, API keys, etc.)

# 2. Deploy with the script
./deploy.sh --env-file .env --uploads-path ./uploads

# Or with --build to force rebuild images
./deploy.sh --env-file .env --uploads-path ./uploads --build
```

### Deployment Options
```bash
# Start services
./deploy.sh --env-file ./production.env --uploads-path /data/uploads

# Stop services
./deploy.sh --down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Services
- **Frontend**: http://localhost (port 80)
- **Backend API**: http://localhost:8000
- **Database**: localhost:5432

### Persistent Storage
The `--uploads-path` parameter specifies where uploaded knowledge base files are stored. This directory is mounted into the backend container to persist data across container restarts.

### Manual Docker Commands
```bash
# Build and start
ENV_FILE=.env UPLOADS_PATH=./uploads docker-compose up -d --build

# Stop
docker-compose down

# Stop and remove volumes (WARNING: deletes database)
docker-compose down -v
```

## Design
The design is based on the provided design assets, utilizing a clean, dashboard-style layout with a sidebar and detailed view for feature requests.
