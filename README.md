# Tradex API

This project contains a simple FastAPI backend for a crypto and stock trading bot. It provides JWT-based authentication, CRUD endpoints for trades stored in PostgreSQL using SQLAlchemy, and a Redis cache for market data.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Configure `DATABASE_URL` and `REDIS_URL` environment variables if different from defaults.
3. Run the application:
   ```bash
   uvicorn app.main:app --reload
   ```

The API documentation is available at `/docs` when the server is running.
