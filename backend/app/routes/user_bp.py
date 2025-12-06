from flask import Blueprint, request
from flask import jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import check_password_hash

from app.framework.exceptions import BizException
from app.models import UserSetting
from app.models import db

user_bp = Blueprint('user', __name__, url_prefix='/api/user')
limiter = Limiter(key_func=get_remote_address)


@user_bp.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = UserSetting.query.filter_by(username=username).first()

    if not user:
        # 使用虚拟哈希消耗时间
        check_password_hash(
            'pbkdf2:sha256:260000$dummy$salt',
            password
        )
        raise BizException("用户名或密码错误")

    if user.pwd_hash != password:
        raise BizException("用户名或密码错误")

    access_token = create_access_token(identity=user.us_id)
    return jsonify(access_token=access_token)


@user_bp.route('/protected', methods=['GET'])
@jwt_required()
def protected():
    current_user_id = get_jwt_identity()
    user = UserSetting.query.get(current_user_id)
    return jsonify(logged_in_as=user.username)


@user_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    pwd_hash = data.get('password')

    if not username or not pwd_hash:
        raise BizException("用户名和密码不能为空")

    # todo 放在前端校验？
    if len(username) < 3 or len(pwd_hash) < 6:
        raise BizException("用户名至少3位，密码至少6位")

    # 检查用户名是否已存在
    existing_user = UserSetting.query.filter_by(username=username).first()
    if existing_user:
        raise BizException("用户名已存在")

    # 创建新用户
    new_user = UserSetting(
        username=username,
        pwd_hash=pwd_hash
    )

    db.session.add(new_user)
    db.session.commit()

    # 注册成功后自动返回token
    access_token = create_access_token(identity=new_user.us_id)
    return {"access_token": access_token}
