// src/components/common/Pagination.jsx
import React, {useState} from "react";

export default function Pagination({pagination, onPageChange, onPerPageChange}) {
    const {page, per_page, total, pages} = pagination || {};
    const [inputPage, setInputPage] = useState(page || 1);

    if (!pagination || pages <= 1) return null;

    const handlePrev = () => {
        if (page > 1) onPageChange(page - 1);
    };

    const handleNext = () => {
        if (page < pages) onPageChange(page + 1);
    };

    const handleJump = () => {
        let p = parseInt(inputPage, 10); // 将用户输入的页码字符串转换为10进制的整数
        if (!isNaN(p)) {  // 检查转换后的页码是否为有效数字
            p = Math.max(1, Math.min(p, pages));
            onPageChange(p);
        }
    };

    return (
        <div className="flex items-center justify-between mt-4 space-x-2">
            <div className="flex items-center space-x-1">
                <button
                    onClick={handlePrev}
                    disabled={page === 1}
                    className="btn-secondary px-3 py-1 disabled:opacity-50"
                >
                    上一页
                </button>
                <span>
          第 {page} / {pages} 页，共 {total} 条
        </span>
                <button
                    onClick={handleNext}
                    disabled={page === pages}
                    className="btn-secondary px-3 py-1 disabled:opacity-50"
                >
                    下一页
                </button>
            </div>

            {/* 快速跳转页码 */}
            <div className="flex items-center space-x-1">
                <input
                    type="number"
                    min={1}
                    max={pages}
                    value={inputPage}
                    onChange={(e) => setInputPage(e.target.value)}
                    className="border rounded px-2 py-1 w-16"
                />
                <button onClick={handleJump} className="btn-secondary px-3 py-1">
                    跳转
                </button>
            </div>

            {/* 每页数量选择 */}
            <div className="flex items-center space-x-1">
                <span>每页</span>
                <select
                    value={per_page}
                    onChange={(e) => onPerPageChange(Number(e.target.value))}
                    className="border rounded px-2 py-1"
                >
                    {[5, 10, 20, 50, 100].map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
