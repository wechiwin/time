# Time Invest My Elevation

一个践行长期投资理念的持仓管理工具。

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

## 测试
```
# 运行所有测试
cd backend
pytest
# 生成 HTML 覆盖率报告
pytest --cov=app --cov-report=html
# 报告位置: backend/htmlcov/index.html
# 运行特定模块测试
pytest backend/app/tests/unit/test_services/test_holding_service.py
# 运行并显示详细输出
pytest -v
```

## 📦 Docker 启动

```bash
docker-compose up --build
```

## 版本

node v16.20.2
python 3.11.8 