from flask import current_app, has_app_context
from flask_caching import Cache
from typing import Any, Optional, Dict, Union, Callable, overload
import json
import pickle
import time
from datetime import datetime, timedelta
import threading
import time
from datetime import datetime
from typing import Any, Optional, Dict, Callable, Union
from flask import current_app, has_app_context
from flask_caching import Cache

# 使用线程锁确保应用级别单例的创建是线程安全的
_app_instance_lock = threading.Lock()


class CacheManager:
    """
    Flask-Caching 管理类，提供线程安全、应用隔离的缓存操作接口。
    通过静态方法提供便捷的、与上下文无关的调用方式。
    """

    def __init__(self, app=None):
        """
        初始化缓存管理器。
        Args:
            app: Flask应用实例，可选。如果提供，则直接初始化。
        """
        self.cache = Cache()
        if app is not None:
            self.init_app(app)

    def init_app(self, app) -> None:
        """
        在应用工厂中初始化

        Args:
            app: Flask应用实例
        """
        # 设置默认配置
        default_config = {
            'CACHE_TYPE': 'simple',
            'CACHE_DEFAULT_TIMEOUT': 300,
            'CACHE_KEY_PREFIX': f"{app.name}_cache_",
            'CACHE_THRESHOLD': 500,
            'CACHE_IGNORE_ERRORS': True
        }

        for key, value in default_config.items():
            if key not in app.config:
                app.config[key] = value
        self.cache.init_app(app)
        # 将自身存入 app.extensions，实现应用级别的单例
        app.extensions['cache_manager'] = self

    @classmethod
    def get_instance(cls) -> 'CacheManager':
        """
        获取当前应用上下文中的 CacheManager 实例。
        这是所有静态方法获取缓存实例的入口。
        Returns:
            CacheManager 实例
        Raises:
            RuntimeError: 如果不在应用上下文中，或缓存未初始化。
        """
        if not has_app_context():
            raise RuntimeError("Cache operations must be performed within a Flask application context.")
        try:
            return current_app.extensions['cache_manager']
        except KeyError:
            raise RuntimeError(
                "CacheManager has not been initialized for the current application. "
                "Make sure to call 'cache_manager.init_app(app)' in your application factory."
            )

    @staticmethod
    def get(key: str, default: Any = None) -> Any:
        """
        静态方法：获取缓存值

        Args:
            key: 缓存键
            default: 默认值

        Returns:
            缓存值或默认值
        """
        instance = CacheManager.get_instance()
        try:
            value = instance.cache.get(key)
            return value if value is not None else default
        except Exception as e:
            current_app.logger.warning(f"Cache get error for key '{key}': {e}")
            return default

    @staticmethod
    def set(key: str, value: Any, timeout: Optional[int] = None) -> bool:
        """
        静态方法：设置缓存值

        Args:
            key: 缓存键
            value: 缓存值
            timeout: 超时时间（秒）

        Returns:
            是否设置成功
        """
        instance = CacheManager.get_instance()
        try:
            instance.cache.set(key, value, timeout=timeout)
            return True
        except Exception as e:
            current_app.logger.error(f"Cache set error for key '{key}': {e}")
            return False

    @staticmethod
    def delete(key: str) -> bool:
        """
        静态方法：删除缓存

        Args:
            key: 缓存键

        Returns:
            是否删除成功
        """
        instance = CacheManager.get_instance()
        try:
            instance.cache.delete(key)
            return True
        except Exception as e:
            current_app.logger.error(f"Cache delete error for key '{key}': {e}")
            return False

    @staticmethod
    def clear() -> bool:
        """
        清空所有缓存

        Returns:
            是否清空成功
        """
        instance = CacheManager.get_instance()
        try:
            instance.cache.clear()
            return True
        except Exception as e:
            current_app.logger.error(f"Cache clear error: {e}")
            return False

    @staticmethod
    def has(key: str) -> bool:
        """
        检查缓存是否存在

        Args:
            key: 缓存键

        Returns:
            是否存在
        """
        instance = CacheManager.get_instance()
        try:
            return instance.cache.has(key)
        except Exception as e:
            current_app.logger.warning(f"Cache 'has' error for key '{key}': {e}")
            return False

    @staticmethod
    def get_many(*keys: str) -> Dict[str, Any]:
        """
        批量获取缓存值

        Args:
            *keys: 多个缓存键

        Returns:
            键值对字典
        """
        instance = CacheManager.get_instance()
        try:
            return instance.cache.get_many(*keys)
        except Exception as e:
            current_app.logger.error(f"Cache get_many error for keys {keys}: {e}")
            return {}

    @staticmethod
    def set_many(mapping: Dict[str, Any], timeout: Optional[int] = None) -> bool:
        """批量设置缓存值。"""
        instance = CacheManager.get_instance()
        try:
            instance.cache.set_many(mapping, timeout=timeout)
            return True
        except Exception as e:
            current_app.logger.error(f"Cache set_many error: {e}")
            return False

    @staticmethod
    def cached(timeout: Optional[int] = None,
               key_prefix: str = 'view/',
               unless: Optional[Callable] = None,
               forced_update: Optional[Callable] = None) -> Callable:
        """
        视图缓存装饰器

        Args:
            timeout: 超时时间
            key_prefix: 键前缀
            unless: 条件函数，返回True时不缓存
            forced_update: 强制更新条件函数

        Returns:
            装饰器函数
        """
        instance = CacheManager.get_instance()
        return instance.cache.cached(timeout=timeout, key_prefix=key_prefix, unless=unless, forced_update=forced_update)

    @staticmethod
    def memoize(timeout: Optional[int] = None,
                unless: Optional[Callable] = None,
                forced_update: Optional[Callable] = None) -> Callable:
        """
        记忆化装饰器（基于函数参数）

        Args:
            timeout: 超时时间
            unless: 条件函数
            forced_update: 强制更新条件函数

        Returns:
            装饰器函数
        """
        instance = CacheManager.get_instance()
        return instance.cache.memoize(timeout=timeout, unless=unless, forced_update=forced_update)

    @staticmethod
    def get_cache_stats() -> Dict[str, Any]:
        """
        获取缓存统计信息

        Returns:
            统计信息字典
        """
        # 这里可以根据实际缓存后端实现统计功能
        # 对于Redis等后端可以获取更多信息
        instance = CacheManager.get_instance()
        return {
            'backend': instance.cache.config.get('CACHE_TYPE'),
            'default_timeout': instance.cache.config.get('CACHE_DEFAULT_TIMEOUT'),
            'key_prefix': instance.cache.config.get('CACHE_KEY_PREFIX'),
            'timestamp': datetime.now().isoformat()
        }
