# app/cli.py
"""
Flask CLI commands for database seeding and maintenance.

Usage:
    flask seed              # Run all seeders
    flask seed --analytics  # Seed analytics_window only
    flask seed --benchmark  # Seed benchmark only
    flask seed --reset      # Clear existing data before seeding
"""

import click
from flask import current_app
from flask.cli import with_appcontext
from loguru import logger

from app.extension import db
from app.models import AnalyticsWindow, Benchmark


# Default seed data
DEFAULT_ANALYTICS_WINDOWS = [
    {'window_key': 'ALL', 'window_type': 'expanding', 'window_days': None, 'description': 'Since Inception'},
    {'window_key': 'R21', 'window_type': 'rolling', 'window_days': 21, 'description': 'Last 21 Trading Days (~1 Month)'},
    {'window_key': 'R63', 'window_type': 'rolling', 'window_days': 63, 'description': 'Last 63 Trading Days (~3 Months)'},
    {'window_key': 'R126', 'window_type': 'rolling', 'window_days': 126, 'description': 'Last 126 Trading Days (~6 Months)'},
    {'window_key': 'R252', 'window_type': 'rolling', 'window_days': 252, 'description': 'Last 252 Trading Days (~1 Year)'},
]

DEFAULT_BENCHMARKS = [
    {'bm_code': '000300.SH', 'bm_name': 'CSI 300'},
    {'bm_code': '000016.SH', 'bm_name': 'SSE 50'},
    {'bm_code': '000905.SH', 'bm_name': 'CSI 500'},
    {'bm_code': '000852.SH', 'bm_name': 'CSI 1000'},
]


def seed_analytics_windows(reset: bool = False) -> int:
    """
    Seed analytics_window table with default window configurations.

    :param reset: If True, delete existing records before seeding
    :return: Number of records inserted
    """
    if reset:
        deleted = db.session.query(AnalyticsWindow).delete()
        logger.info(f"Deleted {deleted} existing AnalyticsWindow records")

    inserted = 0
    for data in DEFAULT_ANALYTICS_WINDOWS:
        existing = AnalyticsWindow.query.filter_by(window_key=data['window_key']).first()
        if existing:
            logger.debug(f"AnalyticsWindow '{data['window_key']}' already exists, skipping")
            continue

        window = AnalyticsWindow(**data)
        db.session.add(window)
        inserted += 1
        logger.debug(f"Added AnalyticsWindow: {data['window_key']}")

    db.session.commit()
    return inserted


def seed_benchmarks(reset: bool = False) -> int:
    """
    Seed benchmark table with default benchmark configurations.

    :param reset: If True, delete existing records before seeding
    :return: Number of records inserted
    """
    if reset:
        deleted = db.session.query(Benchmark).delete()
        logger.info(f"Deleted {deleted} existing Benchmark records")

    inserted = 0
    for data in DEFAULT_BENCHMARKS:
        existing = Benchmark.query.filter_by(bm_code=data['bm_code']).first()
        if existing:
            logger.debug(f"Benchmark '{data['bm_code']}' already exists, skipping")
            continue

        benchmark = Benchmark(**data)
        db.session.add(benchmark)
        inserted += 1
        logger.debug(f"Added Benchmark: {data['bm_code']}")

    db.session.commit()
    return inserted


@click.command('seed')
@click.option('--analytics', 'seed_type', flag_value='analytics', help='Seed analytics_window only')
@click.option('--benchmark', 'seed_type', flag_value='benchmark', help='Seed benchmark only')
@click.option('--reset', is_flag=True, help='Clear existing data before seeding')
@with_appcontext
def seed_command(seed_type, reset):
    """
    Seed database with default configuration data.

    Examples:
        flask seed              # Seed all tables
        flask seed --analytics  # Seed analytics_window only
        flask seed --benchmark  # Seed benchmark only
        flask seed --reset      # Clear and re-seed all tables
    """
    logger.info("Starting database seeding...")

    results = {}

    if seed_type is None or seed_type == 'analytics':
        count = seed_analytics_windows(reset=reset)
        results['analytics_window'] = count
        logger.success(f"Seeded {count} AnalyticsWindow records")

    if seed_type is None or seed_type == 'benchmark':
        count = seed_benchmarks(reset=reset)
        results['benchmark'] = count
        logger.success(f"Seeded {count} Benchmark records")

    click.echo(f"Seeding complete: {results}")
    return results


def init_app(app):
    """Register CLI commands with the Flask app."""
    app.cli.add_command(seed_command)
