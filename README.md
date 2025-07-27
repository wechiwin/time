# stock_fund_tool

一个基于 Flask + React 的个人基金管理工具。

## 项目结构

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx
│   ├── components/
│   │   ├── FundTable.jsx
│   │   ├── TradeTable.jsx
│   │   └── NavTable.jsx
│   ├── index.css
│   └── main.jsx
├── package.json
├── vite.config.js (或 webpack.config.js)

```

## 🧩 功能模块

- 添加/查看基金持仓
- 添加/编辑/删除交易明细
- 获取并显示基金净值历史

## 🚀 快速开始

```bash
# 启动后端（需要 Python3.11）
cd backend
pip install -r requirements.txt
flask db init
flask db migrate -m "init"
flask db upgrade
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
