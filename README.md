# stock_fund_tool

一个基于 Flask + React 的个人基金管理工具。

## 项目结构

```
├── Dockerfile
├── README.md
├── backend
│   ├── app
│   │   ├── __init__.py
│   │   ├── database.py
│   │   ├── framework
│   │   │   └── response.py
│   │   ├── models.py
│   │   └── routes
│   │       ├── __init__.py
│   │       ├── holdings.py
│   │       ├── net_values.py
│   │       └── transactions.py
│   ├── instance
│   ├── requirements.txt
│   └── run.py
├── docker-compose.yml
├── frontend
│   ├── package-lock.json
│   ├── package.json
│   ├── public
│   │   └── index.html
│   ├── src
│   │   ├── App.jsx
│   │   ├── components
│   │   │   ├── FundTable.jsx
│   │   │   ├── NavTable.jsx
│   │   │   └── TradeTable.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   └── vite.config.js

```

## 🧩 功能模块

- 添加/查看基金持仓
- 添加/编辑/删除交易明细
- 获取并显示基金净值历史

## 🚀 快速开始

```bash
# 启动后端（需要 Python3.11）
cd backend
# 使用python虚拟环境
python -m venv venv
# 启动虚拟环境
# windows
.\venv\Scripts\activate
# macos linux
source venv/bin/activate
# 启动虚拟环境成功标志
# 命令行前缀变成这样：
# (venv) PS C:\Users\Administrator\Documents\stock_fund_tool>
# 虚拟环境启动完之后需要在idea里配置python解释器
pip install -r requirements.txt
# flask暂时不用管
#flask db init
#flask db migrate -m "init"
#flask db upgrade
# 启动python 或者右键debug运行run.py
python run.py

# 启动前端
cd frontend
npm install
npm run dev
```

## 📦 Docker 启动

```bash
docker-compose up --build
```

## 🗃 数据表结构

- Holding: id, fund_name, fund_code, fund_type
- Transaction: id, fund_code, transaction_type, transaction_date, transaction_net_value, transaction_shares,
  transaction_fee
- NetValue: id, fund_code, date, unit_net_value

---
如需扩展如净值爬虫、收益计算或分析图表，请联系作者。
