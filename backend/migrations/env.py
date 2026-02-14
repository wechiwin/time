import os
from logging.config import fileConfig

# Set environment variable to skip scheduler initialization during migrations
# Set it BEFORE importing create_app
os.environ['MIGRATION_MODE'] = '1'

from alembic import context
from sqlalchemy import engine_from_config
from sqlalchemy import pool

# Import config to get database URI
from app.config import Config

# Custom config setup for Flask-Migrate
class ConfigWrapper:
    def get_main_option(self, name, default=None):
        """Get config option, prioritizing environment variables"""
        if name == 'sqlalchemy.url':
            return Config.SQLALCHEMY_DATABASE_URI
        return default

config = ConfigWrapper()

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
# Using our custom config wrapper
context.config = config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
# Skipping fileConfig since we don't have an .ini file

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.

from app import create_app
from app.extension import db

app = create_app()
with app.app_context():
    target_metadata = db.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    with app.app_context(): # 确保在 app context 中获取配置
        connectable = engine_from_config(
            {'sqlalchemy.url': app.config['SQLALCHEMY_DATABASE_URI']},
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
