"""
Flask-SQLAlchemy 专用原生 SQL Mapper
示例：holding_analytics__by_snapshot
"""
from pathlib import Path
from typing import List

from sqlalchemy import text

from app.extension import db

_SQL_DIR = Path(__file__).with_suffix('').parent / "sql"


class DashboardMapper:

    @staticmethod
    def _load_sql(name: str) -> str:
        return (_SQL_DIR / f"{name}.sql").read_text(encoding="utf-8")

    # ---------------- 查询封装 ---------------- #
    @classmethod
    def get_holdings_allocation(cls,
                                snapshot_date: str,
                                window_key: str,
                                ) -> List[dict]:
        """
        返回 list[Row]，字段名同 SQL 列名
        """
        sql = text(cls._load_sql("get_holdings_allocation"))
        rows = db.session.execute(
            sql,
            {"snapshot_date": snapshot_date, "window_key": window_key},
        ).mappings().all()
        return [dict(row) for row in rows]
