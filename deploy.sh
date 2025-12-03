#!/bin/bash

# Feature Request Dashboard Deployment Script
# Usage: ./deploy.sh [--env-file <path>] [--uploads-path <path>] [--down] [--build]

set -e

# Default values
ENV_FILE=".env"
UPLOADS_PATH="./uploads"
ACTION="up"
BUILD_FLAG=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        --uploads-path)
            UPLOADS_PATH="$2"
            shift 2
            ;;
        --down)
            ACTION="down"
            shift
            ;;
        --build)
            BUILD_FLAG="--build"
            shift
            ;;
        -h|--help)
            echo "Feature Request Dashboard Deployment Script"
            echo ""
            echo "Usage: ./deploy.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --env-file <path>     Path to environment file (default: .env)"
            echo "  --uploads-path <path> Path for persistent file storage (default: ./uploads)"
            echo "  --build               Force rebuild of Docker images"
            echo "  --down                Stop and remove containers"
            echo "  -h, --help            Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./deploy.sh --env-file ./production.env --uploads-path /data/uploads"
            echo "  ./deploy.sh --build"
            echo "  ./deploy.sh --down"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if env file exists
if [[ "$ACTION" == "up" && ! -f "$ENV_FILE" ]]; then
    echo "Error: Environment file not found: $ENV_FILE"
    echo "Please create an environment file or specify one with --env-file"
    echo ""
    echo "You can copy the example file:"
    echo "  cp backend/.env.example .env"
    exit 1
fi

# Create uploads directory if it doesn't exist
if [[ "$ACTION" == "up" ]]; then
    mkdir -p "$UPLOADS_PATH/knowledge"
    echo "Uploads directory: $UPLOADS_PATH"
fi

# Export variables for docker-compose
export ENV_FILE
export UPLOADS_PATH

if [[ "$ACTION" == "down" ]]; then
    echo "Stopping Feature Request Dashboard..."
    docker compose down
    echo "Done!"
else
    echo "Starting Feature Request Dashboard..."
    echo "Environment file: $ENV_FILE"
    echo "Uploads path: $UPLOADS_PATH"
    echo ""
    docker compose up -d $BUILD_FLAG
    echo ""
    echo "Services started successfully!"
    echo "  Frontend: http://localhost"
    echo "  Backend API: http://localhost:8000"
    echo "  Database: localhost:5432"
    echo ""
    echo "View logs: docker compose logs -f"
fi
