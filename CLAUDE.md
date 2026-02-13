# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TIME (Transaction-based Investment Management Engine) is a full-stack personal investment analytics platform with a decoupled React/Flask architecture. The system is designed for transaction-level accuracy, auditable financial logic, and quantitative performance evaluation.

## Commands

### Frontend (React + Vite)
```bash
cd frontend
npm install           # Install dependencies
npm run dev           # Start dev server (http://localhost:5173)
npm run build         # Production build
npm run preview       # Preview production build
```

### Backend (Flask)
```bash
cd backend
pip install -r requirements.txt    # Install dependencies
flask run                           # Start dev server (http://127.0.0.1:5000)
```

### Database Migrations (Alembic)
```bash
cd backend
flask db migrate -m "description"   # Create migration
flask db upgrade                    # Apply migrations
flask db downgrade                  # Rollback last migration
```

### Testing (Pytest)
```bash
cd backend
pytest                              # Run all tests
pytest tests/test_holding_service.py # Run specific test file
pytest -v                           # Verbose output
pytest --cov=app                    # With coverage
```

### Docker (Production)
```bash
docker-compose up -d                # Build and start container
```

## Architecture

### High-Level Structure

```
Frontend (React)          Backend (Flask)         Database
     |                          |                    |
     +--- REST API / SSE ------>+------> PostgreSQL |
```

### Backend: Flask Application Factory

The application is built using the factory pattern defined in `backend/app/factory.py::build_app()`. The initialization sequence is critical:

1. Create Flask instance
2. Load configuration (from `Config.get_config()`)
3. Setup logging (Loguru-based)
4. Compile translations (.po → .mo) if needed
5. Initialize extensions (DB, JWT, CORS, Scheduler, etc.)
6. Register blueprints, interceptors, error handlers

The app is accessed via `from app import create_app` in `backend/app/__init__.py`.

### Backend: Layered Architecture

```
Routes → Services → Models
```

**Routes** (`backend/app/routes/`):
- `system_bp.py` - System endpoints (health check, etc.)
- `time_bp.py` - Main API blueprint with `/time` prefix
  - Sub-blueprints: `user_bp`, `dashboard_bp`, `holding_bp`, `trade_bp`, `alert_bp`, `nav_history_bp`, `task_bp`, `common_bp`, and various snapshot blueprints

**Services** (`backend/app/service/`):
- Business logic layer
- Transaction management
- Analytics computation
- Data ingestion services

**Models** (`backend/app/models.py`):
- SQLAlchemy ORM models with base model for sensitive field protection
- All financial entities defined here

### Frontend: API Client

`frontend/src/api/client.js` contains the Axios-based API client with:
- JWT token management and auto-refresh
- Request/response interceptors
- Cookie-based authentication
- Internationalization headers

### Analytics Engine: Snapshot Pattern

The system uses a **snapshot-based design** for analytics:
- Daily snapshots serve as the single source of truth
- All analytics are derived from historical snapshots for full auditability
- Supports expanding and rolling window calculations (TWRR, IRR, Sharpe, etc.)

### Background Processing

APScheduler handles periodic jobs (`backend/app/scheduler/`):
- Daily fund NAV crawling at 2:00 AM
- Async task consumption every minute
- Jobs use Flask app context wrapper

## Configuration

### Environment Files

| Environment | Backend | Frontend |
|-------------|---------|----------|
| Development | `.env` | `.env.local` |
| Testing | `.env.test` | - |
| Production | `.env.prod` | `.env.production` |

### Key Config Areas

- Database URI (PostgreSQL connection string)
- JWT settings (token expiry, cookie settings)
- CORS origins
- Email SMTP settings (for alerts)
- OpenAI API key (for OCR features)
- Caching configuration

## Authentication

JWT-based authentication with:
- Access tokens: 15-minute expiry
- Refresh tokens: 7-day expiry
- HTTP-only cookies + Authorization header
- Maximum 3 concurrent devices
- Silent token refresh mechanism in frontend

## Internationalization

- **Backend**: Flask-Babel with `backend/translations/` (EN/IT/ZH)
- **Frontend**: i18next with dynamic language detection
- Locale determined by `lang` query param or `Accept-Language` header
- `.po` files automatically compiled to `.mo` on app startup

## Database

### Schema Design

PostgreSQL with referential integrity between:
- Transactions
- Holdings
- Snapshots
- Assets

### Migration System

Alembic configured at `backend/alembic.ini`:
- Script location: `backend/migrations/`
- Models auto-discovery: `backend/app/models.py`
- Environment-specific configs

## Testing

### Test Structure

- Tests in `backend/tests/`
- Pytest framework with fixtures
- SQLite in-memory database for tests
- Factory-boy for test data generation

### Fixtures (`conftest.py`)

- `app` - Flask application with test config
- `db` - Fresh database per test function
- `client` - Test client
- `mock_user` - Test user fixture
- `auth_headers` - Authentication headers for protected endpoints

## Key Architectural Patterns

1. **Factory Pattern** - Flask app creation and configuration
2. **Blueprint Pattern** - Modular route organization
3. **Service Layer** - Business logic separation
4. **Snapshot Pattern** - Time-based portfolio state tracking
5. **Event-Driven** - Background job processing
6. **Layered Architecture** - Routes → Services → Models

## Important Notes

- The app factory MUST initialize in the correct order (see `factory.py`)
- All analytics should use snapshots, not raw transactions
- Use Flask-Caching for high-frequency dashboard queries
- Sensitive fields are automatically redacted in model representations
- Translation files are compiled automatically on startup if modified
- Production uses Gunicorn as WSGI server (see Docker setup)
