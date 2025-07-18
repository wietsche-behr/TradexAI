# Tradex API

This project contains a simple FastAPI backend for a crypto and stock trading bot. It provides JWT-based authentication, CRUD endpoints for trades stored in a Supabase database, and a Redis cache for market data.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Create a project in [Supabase](https://supabase.com) and create `users` and `trades` tables matching the models in `app/schemas.py`.
3. Grab your project API URL and service role key from the Supabase dashboard and set them as environment variables:
   ```bash
   export SUPABASE_URL=https://<project-id>.supabase.co
   export SUPABASE_KEY=<your-service-role-key>
   export REDIS_URL=redis://localhost:6379/0  # optional
   ```
4. Run the application:
   ```bash
   uvicorn app.main:app --reload
   ```

The API documentation is available at `/docs` when the server is running.
