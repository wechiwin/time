# Time Invest My Elevation

一个践行长期投资理念的持仓管理工具。

## 项目结构

```
├── .gitignore
├── Dockerfile
├── README.md
├── backend
│   ├── app
│   │   ├── __init__.py
│   │   ├── database.py
│   │   ├── framework
│   │   │   ├── log_config.py
│   │   │   └── response.py
│   │   ├── models.py
│   │   └── routes
│   │       ├── __init__.py
│   │       ├── holdings.py
│   │       ├── net_values.py
│   │       └── transactions.py
│   ├── instance
│   │   └── site.db
│   ├── requirements.txt
│   └── run.py
├── docker-compose.yml
└── frontend
    ├── index.html
    ├── package-lock.json
    ├── package.json
    ├── postcss.config.js
    ├── public
    │   └── manifest.json
    ├── src
    │   ├── App.jsx
    │   ├── api
    │   │   └── client.js
    │   ├── components
    │   │   ├── common
    │   │   │   ├── DeleteButton.jsx
    │   │   │   ├── FormModal.jsx
    │   │   │   ├── Modal.jsx
    │   │   │   ├── Pagination.jsx
    │   │   │   └── withPagination.jsx
    │   │   ├── forms
    │   │   │   ├── HoldingForm.jsx
    │   │   │   ├── NavHistoryForm.jsx
    │   │   │   └── TradeForm.jsx
    │   │   ├── layout
    │   │   │   ├── DarkToggle.jsx
    │   │   │   ├── Header.jsx
    │   │   │   ├── Layout.jsx
    │   │   │   └── Sidebar.jsx
    │   │   ├── searchList
    │   │   │   ├── HoldingSearchBox.jsx
    │   │   │   ├── HoldingSearchSelect.jsx
    │   │   │   ├── NetValueSearchBox.jsx
    │   │   │   ├── SearchBox.jsx
    │   │   │   └── TransactionSearchBox.jsx
    │   │   ├── tables
    │   │   │   ├── HoldingTable.jsx
    │   │   │   ├── NavHistoryTable.jsx
    │   │   │   └── TradeTable.jsx
    │   │   └── toast
    │   │       ├── Toast.jsx
    │   │       └── ToastContext.jsx
    │   ├── constants
    │   │   └── sysConst.js
    │   ├── context
    │   ├── hooks
    │   │   ├── api
    │   │   │   ├── useHoldingList.js
    │   │   │   ├── useNavHistoryList.js
    │   │   │   └── useTradeList.js
    │   │   ├── useApi.js
    │   │   ├── useDarkMode.js
    │   │   ├── useDebouncedSearch.js
    │   │   ├── useDeleteWithToast.js
    │   │   └── usePagination.js
    │   ├── index.css
    │   ├── main.jsx
    │   └── pages
    │       ├── Dashboard.jsx
    │       ├── HoldingPage.jsx
    │       ├── NavHistoryPage.jsx
    │       └── TradePage.jsx
    ├── tailwind.config.js
    └── vite.config.js

```

## 🧩 功能模块

- 添加/查看基金持仓
- 添加/编辑/删除交易明细
- 爬虫获取并显示基金净值历史

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

windows如果启动虚拟环境遇到报错

```
.\venv\Scripts\activate : 无法加载文件 C:\Users\Administrator\Documents\PycharmProject\stock_fund_tool\venv\Scripts\Activate.ps1，因为在此系统上禁止运行脚本。有关详细信息，请参阅 https:/go.m
icrosoft.com/fwlink/?LinkID=135170 中的 about_Execution_Policies。
所在位置 行:1 字符: 1
+ .\venv\Scripts\activate
+ ~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : SecurityError: (:) []，PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess

```

这是 **PowerShell 的执行策略限制** 导致你无法激活虚拟环境。Windows 默认出于安全原因**禁止运行 `.ps1` 脚本**，但你可以按照下面方法轻松解决

方法一：临时更改当前会话的执行策略（推荐）
```
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```
方法二：永久允许（需管理员权限，不推荐日常使用）
```
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
# 你会看到提示，输入 `Y` 确认。
```


## 📦 Docker 启动

```bash
docker-compose up --build
```

## 🗃 数据表结构

- trade: tr_id, ho_code, tr_type, tr_date, tr_nav_per_unit, tr_shares, tr_fee, tr_amount, created_at, updated_at
- nav_history: nav_id, ho_code, nav_date, nav_per_unit, nav_accumulated_per_unit

```sqlite
create table holding  -- 持仓表
(
    ho_id             INTEGER not null
        primary key,
    ho_name           VARCHAR(100),     -- 基金名称
    ho_code           VARCHAR(50)       -- 基金代码
        unique,
    ho_type           VARCHAR(50),      -- 基金类型
    ho_establish_date TEXT,             -- 创建时间
    ho_short_name     VARCHAR(100),     -- 基金简称
    manage_exp_rate   FLOAT,            -- 管理费率
    trustee_exp_rate  FLOAT,            -- 托管费率
    sales_exp_rate    FLOAT,            -- 销售费率
    created_at        TEXT,
    updated_at        TEXT
);

create table nav_history -- 历史净值表
(
    nav_id                   INTEGER not null
        primary key,
    ho_code                  VARCHAR(50),
    nav_date                 VARCHAR(20),   -- 净值日期
    nav_per_unit             FLOAT,         -- 单位净值
    nav_accumulated_per_unit FLOAT,         -- 累计单位净值
    constraint navh_code_date_uk
        unique (ho_code, nav_date)
);

create table trade -- 交易记录表
(
    tr_id           INTEGER not null
        primary key,
    ho_code         VARCHAR(50),
    tr_type         INTEGER,            -- 交易类型：1.买入；0.卖出
    tr_date         VARCHAR(20),        -- 交易日期
    tr_nav_per_unit FLOAT,              -- 交易单位净值
    tr_shares       FLOAT,              -- 交易份额
    tr_fee          FLOAT,              -- 交易费用
    tr_amount       float,              -- 交易金额(不含交易费用)
    created_at      TEXT,
    updated_at      TEXT
);



create table alert_rule  -- 提醒规则表
(
ar_id               INTEGER not null
    primary key,
ho_code             varchar(50),  -- 基金代码
ar_type             integer,  -- 提醒类型：1.买入/2.加仓/0.卖出
ar_target_navpu float,    -- 目标单位净值
ar_is_active           integer,  -- 是否激活:1.是;0.否
created_at          text,
updated_at          text
);

create table alert_history -- 提醒记录表
(
    ah_id             integer
        constraint alert_history_pk
            primary key,
    ar_id             integer,
    ah_triggered_time TEXT,         -- 触发时间
    ah_status         integer,       -- 发送状态:0:'pending', 1:'sent', 2:'failed'
    created_at          text,
    updated_at          text
);


```

## 版本

node v16.20.2
python 3.11.8 