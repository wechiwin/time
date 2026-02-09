from flask import Blueprint
from sqlalchemy import text

from app.extension import db
from app.framework.res import Res

system_bp = Blueprint('system_bp', __name__)


@system_bp.route('/')
def index():
    return Res.success("Welcome to the TIME!")


@system_bp.route('/health')
def health_check():
    """
    A health check endpoint to verify the application's status.
    """
    db.session.execute(text("SELECT 1"))
    return Res.success("API & DB is running.")
