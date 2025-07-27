FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ backend/
WORKDIR /app/backend
CMD ["python", "run.py"]