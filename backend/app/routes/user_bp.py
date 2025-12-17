from datetime import timedelta

from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, create_refresh_token, get_jwt
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from app.framework.exceptions import BizException
from app.models import UserSetting, TokenBlacklist
from app.models import db

user_bp = Blueprint('user_setting', __name__, url_prefix='/api/user_setting')
limiter = Limiter(key_func=get_remote_address)
# Token配置
ACCESS_TOKEN_EXPIRES = timedelta(hours=6)
REFRESH_TOKEN_EXPIRES = timedelta(days=7)


@user_bp.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = UserSetting.query.filter_by(username=username).first()

    if user and UserSetting.verify_password(password, user.pwd_hash):
        access_token = create_access_token(identity=user.username,
                                           expires_delta=ACCESS_TOKEN_EXPIRES)
        refresh_token = create_refresh_token(identity=user.username,
                                             expires_delta=REFRESH_TOKEN_EXPIRES)

        response = jsonify({
            "code": 200,
            "message": "登录成功",
            "data": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": {
                    "id": user.us_id,
                    "username": user.username,
                    "default_lang": user.default_lang,
                    "email_address": user.email_address,
                }
            }
        })
        # 设置HttpOnly cookies（可选）
        response.set_cookie(
            'refresh_token',
            refresh_token,
            httponly=True,
            secure=True,  # 生产环境启用
            samesite='Strict',
            max_age=7 * 24 * 60 * 60  # 7天
        )

        return response
    else:
        raise BizException("用户名或密码错误")  # TODO 多语言


@user_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    try:
        current_username = get_jwt_identity()
        jti = get_jwt()["jti"]

        # 检查refresh token是否在黑名单中
        blacklisted = TokenBlacklist.query.filter_by(jti=jti).first()
        if blacklisted:
            raise BizException("Token已失效", code=401)

        new_token = create_access_token(
            identity=current_username,
            expires_delta=ACCESS_TOKEN_EXPIRES
        )

        return jsonify({"access_token": new_token})
    except Exception as e:
        raise BizException("Token刷新失败", code=401)


@user_bp.route('/user', methods=['GET'])
@jwt_required()
def get_user():
    current_username = get_jwt_identity()
    user = UserSetting.query.filter_by(username=current_username).first()

    if not user:
        raise BizException("用户不存在")

    return jsonify({
        "id": user.us_id,
        "username": user.username,
        "default_lang": user.default_lang,
        "email_address": user.email_address,
    })


@user_bp.route('/user', methods=['PUT'])
@jwt_required()
def update_user():
    """更新用户基本信息"""
    current_username = get_jwt_identity()
    user = UserSetting.query.filter_by(username=current_username).first()

    if not user:
        raise BizException("用户不存在")

    email_address = request.args.get('email_address')
    default_lang = request.args.get('default_lang')

    # 更新
    if email_address and user.email_address != email_address:
        user.email_address = email_address
    if default_lang and user.default_lang != default_lang:
        user.default_lang = default_lang

    db.session.commit()
    return ''


@user_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        raise BizException("用户名和密码不能为空")

    if len(username) < 3 or len(password) < 6:
        raise BizException("用户名至少3位，密码至少6位")

    # 检查用户名是否已存在
    existing_user = UserSetting.query.filter_by(username=username).first()
    if existing_user:
        raise BizException("用户名已存在")

    # 创建新用户
    # 安全哈希后存储
    pwd_hash = UserSetting.hash_password(password)
    new_user = UserSetting(
        username=username,
        pwd_hash=pwd_hash
    )

    db.session.add(new_user)
    db.session.commit()

    # 注册成功后自动返回token
    access_token = create_access_token(identity=new_user.username)
    refresh_token = create_refresh_token(identity=new_user.username)
    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token
    })


@user_bp.route('/pwd', methods=['POST'])
@jwt_required()
def edit_password():
    current_username = get_jwt_identity()
    user = UserSetting.query.filter_by(username=current_username).first()
    if not user:
        raise BizException("用户不存在")

    data = request.get_json()
    old_password = data.get('old_password')
    new_password = data.get('new_password')

    if not old_password or not new_password:
        raise BizException("原密码和新密码都不能为空")
    if old_password == new_password:
        raise BizException("新密码不能与原密码相同")
    if len(new_password) < 6:
        raise BizException("新密码至少6位")

    # 验证原密码
    if not UserSetting.verify_password(old_password, user.pwd_hash):
        raise BizException("原密码错误")
    # 更新为新密码（哈希存储）
    user.pwd_hash = UserSetting.hash_password(new_password)
    db.session.commit()

    # 返回新token
    access_token = create_access_token(identity=user.username)
    refresh_token = create_refresh_token(identity=user.username)
    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token
    })


@user_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    try:
        jti = get_jwt()["jti"]
        # 将token加入黑名单
        blacklisted_token = TokenBlacklist(jti=jti)
        db.session.add(blacklisted_token)
        db.session.commit()

        response = jsonify({
            "code": 200,
            "message": "登出成功"
        })

        # 清除cookie
        response.set_cookie('refresh_token', '', expires=0)

        return response
    except Exception as e:
        db.session.rollback()
        raise BizException("登出失败")
