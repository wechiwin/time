import json
import logging
import threading
import uuid
from io import BytesIO
from queue import Queue

import pandas as pd
from flask import Blueprint, request, Response, stream_with_context, current_app, g
from flask import send_file
from flask_babel import gettext
from sqlalchemy import desc, or_
from sqlalchemy.orm import joinedload

from app.constant.biz_enums import ErrorMessageEnum
from app.framework.auth import auth_required
from app.framework.exceptions import BizException
from app.framework.res import Res
from app.models import db, Trade, Holding
from app.schemas_marshall import TradeSchema, marshal_pagination
from app.service.trade_service import TradeService
from app.utils.user_util import get_or_raise

trade_bp = Blueprint('trade', __name__, url_prefix='/api/trade')

task_queues = {}
logger = logging.getLogger(__name__)


@trade_bp.route('/tr_page', methods=['POST'])
@auth_required
def tr_page():
    data = request.get_json()
    ho_code = data.get('ho_code')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    keyword = data.get('keyword')
    # 添加分页参数
    page = data.get('page') or 1
    per_page = data.get('per_page') or 10
    tr_type = data.get('tr_type')

    query = Trade.query.options(joinedload(Trade.holding))
    query = query.filter_by(user_id=g.user.id)

    if ho_code:
        query = query.filter_by(ho_code=ho_code)
    if start_date:
        query = query.filter(Trade.tr_date >= start_date)
    if end_date:
        query = query.filter(Trade.tr_date <= end_date)
    if tr_type:
        query = query.filter(Trade.tr_type == tr_type)
    if keyword:
        query = query.join(Holding, Trade.ho_id == Holding.id).filter(
            or_(
                Holding.ho_code.ilike(f'%{keyword}%'),
                Holding.ho_short_name.ilike(f'%{keyword}%')
            )
        )

    # 使用分页查询
    pagination = query.order_by(desc(Trade.tr_date)).paginate(
        page=page, per_page=per_page, error_out=False
    )
    result = marshal_pagination(pagination, TradeSchema)

    return Res.success(result)


@trade_bp.route('/add_tr', methods=['POST'])
@auth_required
def add_tr():
    data = request.get_json()
    required_fields = ['tr_type', 'tr_date', 'tr_nav_per_unit',
                       'tr_shares', 'tr_amount', 'tr_fee', 'cash_amount', ]

    if not all(field in data for field in required_fields):
        raise BizException(msg=ErrorMessageEnum.MISSING_FIELD.value)

    new_transaction = TradeSchema().load(data)
    new_transaction.user_id = g.user.id
    return Res.success() if TradeService.create_transaction(new_transaction) else Res.fail()


@trade_bp.route('/get_tr', methods=['POST'])
@auth_required
def get_transaction():
    data = request.get_json()
    id = data.get('id')
    t = get_or_raise(Trade, id)
    return Res.success(TradeSchema().dump(t))


@trade_bp.route('/update_tr', methods=['POST'])
@auth_required
def update_tr():
    data = request.get_json()
    id = data.get('id')
    t = get_or_raise(Trade, id)

    updated_trade = TradeSchema().load(data, instance=t, partial=True)

    db.session.add(updated_trade)
    db.session.flush()
    TradeService.recalculate_holding_trades(updated_trade.ho_id)
    db.session.commit()
    return Res.success()


@trade_bp.route('/del_tr', methods=['POST'])
@auth_required
def del_tr():
    data = request.get_json()
    id = data.get('id')
    t = get_or_raise(Trade, id)
    ho_id = t.ho_id

    db.session.delete(t)
    db.session.flush()
    TradeService.recalculate_holding_trades(ho_id)

    db.session.commit()
    return Res.success()


@trade_bp.route('/export', methods=['GET'])
@auth_required
def export_trade():
    trade = Trade.query.all()
    df = pd.DataFrame([{
        gettext('COL_HO_CODE'): t.ho_code,
        gettext('COL_TR_TYPE'): t.tr_type,
        gettext('COL_TR_DATE'): t.tr_date,
        gettext('COL_TR_NAV_PER_UNIT'): t.tr_nav_per_unit,
        gettext('COL_TR_SHARES'): t.tr_shares,
        gettext('COL_TR_AMOUNT'): t.tr_amount,
        gettext('COL_TR_FEE'): t.tr_fee,
        gettext('COL_CASH_AMOUNT'): t.cash_amount,
    } for t in trade])

    output = BytesIO()
    writer = pd.ExcelWriter(output, engine='xlsxwriter')
    df.to_excel(writer, index=False, sheet_name=gettext('TR_LOG'))
    writer.close()
    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='tradeLog.xlsx'
    )


@trade_bp.route('/template', methods=['GET'])
@auth_required
def download_template():
    # 创建一个空的DataFrame，只有列名
    df = pd.DataFrame(columns=[
        # '基金代码',
        gettext('COL_HO_CODE'),
        # '交易类型',
        gettext('COL_TR_TYPE'),
        # '交易日期',
        gettext('COL_TR_DATE'),
        # '交易净值',
        gettext('COL_TR_NAV_PER_UNIT'),
        # '交易份数',
        gettext('COL_TR_SHARES'),
        # '交易金额',
        gettext('COL_TR_AMOUNT'),
        # '交易费用',
        gettext('COL_TR_FEE'),
        # '实际收付',
        gettext('COL_CASH_AMOUNT'),
    ])

    # 添加示例数据（使用concat替代append）
    example_data = pd.DataFrame([{
        gettext('COL_HO_CODE'): gettext('TR_EXAMPLE'),
        gettext('COL_TR_TYPE'): gettext('TR_BUY'),
        gettext('COL_TR_DATE'): '2023-01-01',
        gettext('COL_TR_NAV_PER_UNIT'): 1.0,
        gettext('COL_TR_SHARES'): 100,
        gettext('COL_TR_AMOUNT'): 100,
        gettext('COL_TR_FEE'): 0.1,
        gettext('COL_CASH_AMOUNT'): 100.1,
    }])

    df = pd.concat([df, example_data], ignore_index=True)

    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name=gettext('TEMPLATE_TR_IMPORT'))

        # 添加数据验证（可选）
        workbook = writer.book
        worksheet = writer.sheets[gettext('TEMPLATE_TR_IMPORT')]

        # 为交易类型列添加下拉验证
        worksheet.data_validation('B2:B100', {
            'validate': 'list',
            'source': [gettext('TR_BUY'), gettext('TR_SELL')]
        })

    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='TradeImportTemplate.xlsx'
    )


@trade_bp.route('/import', methods=['POST'])
@auth_required
def import_trade():
    if 'file' not in request.files:
        raise BizException(msg="没有上传文件")

    file = request.files['file']
    if file.filename == '':
        raise BizException(msg="没有选择文件")

    df = pd.read_excel(file, dtype={gettext('COL_HO_CODE'): str})
    required_columns = [
        # '基金代码',
        gettext('COL_HO_CODE'),
        # '交易类型',
        gettext('COL_TR_TYPE'),
        # '交易日期',
        gettext('COL_TR_DATE'),
        # '交易净值',
        gettext('COL_TR_NAV_PER_UNIT'),
        # '交易份数',
        gettext('COL_TR_SHARES'),
        # '交易金额',
        gettext('COL_TR_AMOUNT'),
        # '交易费用',
        gettext('COL_TR_FEE'),
        # '实际收付',
        gettext('COL_CASH_AMOUNT'),
    ]
    if not all(col in df.columns for col in required_columns):
        raise BizException(msg="Excel缺少必要列")

    # 转换日期列为字符串格式
    df[gettext('COL_TR_DATE')] = pd.to_datetime(df[gettext('COL_TR_DATE')], errors='coerce')
    df[gettext('COL_TR_DATE')] = df[gettext('COL_TR_DATE')].dt.strftime('%Y-%m-%d')  # 处理Timestamp类型

    # 转换数值列为float（防止整数被识别为其他类型）
    numeric_cols = [
        gettext('COL_TR_NAV_PER_UNIT'),
        gettext('COL_TR_SHARES'),
        gettext('COL_CASH_AMOUNT'),
        gettext('COL_TR_FEE'),
        gettext('COL_TR_AMOUNT')
    ]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    transactions = []
    for _, row in df.iterrows():
        transaction = Trade(
            ho_code=str(row[gettext('COL_HO_CODE')]),
            tr_type=map_trade_type(row[gettext('COL_TR_TYPE')]),
            tr_date=str(row[gettext('COL_TR_DATE')]),
            tr_nav_per_unit=float(row[gettext('COL_TR_NAV_PER_UNIT')]),
            tr_shares=float(row[gettext('COL_TR_SHARES')]),
            tr_amount=float(row[gettext('COL_TR_AMOUNT')]),
            tr_fee=float(row[gettext('COL_TR_FEE')]),
            cash_amount=float(row[gettext('COL_CASH_AMOUNT')]),
        )
        transactions.append(transaction)

    return Res.success(TradeService.import_trade(transactions))


ALL_TR_TYPE_TEXTS = {
    # 中文
    "买入": 'BUY',
    "卖出": 'SELL',
    # 英文
    "Buy": 'BUY',
    "Sell": 'SELL',
    # 意大利语
    "Acquisto": 'BUY',
    "Vendita": 'SELL',
}


def map_trade_type(value):
    value = str(value).strip()
    if value not in ALL_TR_TYPE_TEXTS:
        raise BizException(
            msg=f"交易类型“{value}”无法识别，请使用模板提供的下拉选项。"
        )
    return ALL_TR_TYPE_TEXTS[value]


@trade_bp.route('/list_by_ho_id', methods=['POST'])
@auth_required
def list_by_ho_id():
    data = request.get_json()
    ho_id = data.get('ho_id')
    if not ho_id:
        return ''

    result_list = Trade.query.filter_by(ho_id=ho_id).order_by(Trade.tr_date.asc()).all()
    return Res.success(TradeSchema(many=True).dump(result_list))


@trade_bp.route("/upload", methods=["POST"])
@auth_required
def upload():
    file = request.files.get("file")
    if not file:
        return {"error": "No file"}

    file_bytes = file.read()
    # print(file_bytes)
    result = TradeService.process_trade_image_online(file_bytes)

    resp = {
        "ocr_text": result["ocr_text"],
        "parsed_json": result["parsed_json"]
    }
    return Res.success(resp)


def background_worker(task_id, file_bytes, app):
    """
    后台线程运行的函数
    """
    with app.app_context():
        try:
            # 实例化服务 (如果你的 Service 没有状态，也可以在外面实例化)
            logger.info(f"Task {task_id}: 开始调用 LLM...")

            # 调用耗时的 LLM 逻辑
            # result = TradeService.process_trade_image_local(file_bytes)
            result = TradeService.process_trade_image_online(file_bytes)

            # 将结果放入队列
            if task_id in task_queues:
                task_queues[task_id].put({"status": "success", "data": result})

        except Exception as e:
            logger.error(f"Task {task_id} Error: {e}")
            if task_id in task_queues:
                task_queues[task_id].put({"status": "error", "message": str(e)})


@trade_bp.route("/upload_sse", methods=["POST"])
@auth_required
def upload_sse():
    """
    第一步：上传文件，启动后台线程，立即返回 task_id
    """
    file = request.files.get("file")
    if not file:
        return {"error": "No file"}

    # 读取文件字节流
    file_bytes = file.read()

    # 生成唯一任务 ID
    task_id = str(uuid.uuid4())

    # 创建该任务的通信队列
    task_queues[task_id] = Queue()
    app = current_app._get_current_object()
    # 启动后台线程 (Daemon=True 防止主进程退出时线程卡死)
    thread = threading.Thread(target=background_worker, args=(task_id, file_bytes, app))
    thread.daemon = True
    thread.start()

    # 立即响应，避免 HTTP 超时
    result = {
        "message": "Processing started",
        "task_id": task_id
    }
    return Res.success(result)


@trade_bp.route("/stream/<task_id>")
@auth_required
def stream(task_id):
    """
    第二步：前端监听此接口，等待结果推送
    """

    def generate():
        q = task_queues.get(task_id)
        if not q:
            yield f"data: {json.dumps({'error': 'Task not found or expired'})}\n\n"
            return

        try:
            # 阻塞等待队列中有数据 (设置一个较长的超时时间，比如 60秒)
            # 这样不会占用 CPU，直到后台线程 put 进数据
            result = q.get(timeout=60)

            # SSE 标准格式：data: <json_string>\n\n
            yield f"data: {json.dumps(result)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            # 清理资源
            if task_id in task_queues:
                del task_queues[task_id]

    # mimetype 必须设置为 text/event-stream
    return Response(stream_with_context(generate()), mimetype='text/event-stream')
