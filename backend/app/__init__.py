# app/__init__.py
from app.factory import build_app as create_app

__all__ = ['create_app']
