FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=utf-8

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Create logs directory for Loguru (must exist before flask db upgrade runs)
RUN mkdir -p /app/logs

EXPOSE 8080

# Run database migrations before starting the app
# Note: Ensure SQLALCHEMY_DATABASE_URI in .env.prod is correctly configured for Neon PostgreSQL
RUN flask db upgrade

# 使用 gunicorn.conf.py 配置文件
# 该配置确保 APScheduler 只在 worker 0 中运行，避免重复执行和内存问题
CMD ["gunicorn", "-c", "gunicorn.conf.py", "wsgi:app"]
