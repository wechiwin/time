# app/cache.py
"""
缓存模块
提供全局缓存实例，避免循环导入问题
"""
from flask_caching import Cache

# 创建全局缓存实例
cache = Cache()
