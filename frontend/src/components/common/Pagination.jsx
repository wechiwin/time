// src/components/common/Pagination.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import useDarkMode from "../../hooks/useDarkMode";

// 最大显示的页码按钮数量
const MAX_PAGE_BUTTONS = 5;

/**
 * 分页组件
 * @param {Object} pagination - 分页数据 {page, per_page, total, pages}
 * @param {Function} onPageChange - 页码改变回调
 * @param {Function} onPerPageChange - 每页数量改变回调
 */
export default function Pagination({ pagination, onPageChange, onPerPageChange }) {
    const { page = 1, per_page = 10, total = 0, pages = 1 } = pagination || {};
    const [inputPage, setInputPage] = useState(page);
    const { t } = useTranslation();
    const { dark } = useDarkMode();

    // 当外部page变化时，同步更新输入框的值
    useEffect(() => {
        setInputPage(page);
    }, [page]);

    // 如果分页数据无效或只有一页，不渲染组件
    if (!pagination || pages <= 1) return null;

    // 防止在最后一页时，由于total减少导致page超出范围
    const currentPage = Math.min(page, pages);

    /**
     * 上一页点击处理
     */
    const handlePrev = useCallback(() => {
        if (currentPage > 1) {
            onPageChange(currentPage - 1);
        }
    }, [currentPage, onPageChange]);

    /**
     * 下一页点击处理
     */
    const handleNext = useCallback(() => {
        if (currentPage < pages) {
            onPageChange(currentPage + 1);
        }
    }, [currentPage, pages, onPageChange]);

    /**
     * 跳转到指定页
     */
    const handleJump = useCallback(() => {
        let p = parseInt(inputPage, 10);
        if (!isNaN(p)) {
            p = Math.max(1, Math.min(p, pages));
            if (p !== currentPage) {
                onPageChange(p);
            }
        }
    }, [inputPage, currentPage, pages, onPageChange]);

    /**
     * 输入框回车键处理
     */
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === "Enter") {
                handleJump();
            }
        },
        [handleJump]
    );

    /**
     * 生成页码按钮组
     * 显示逻辑：显示当前页附近的页码，前后用省略号表示
     */
    const getPageButtons = useCallback(() => {
        const buttons = [];
        const half = Math.floor(MAX_PAGE_BUTTONS / 2);

        // 计算要显示的页码范围
        let start = Math.max(1, currentPage - half);
        let end = Math.min(pages, start + MAX_PAGE_BUTTONS - 1);

        // 如果显示的页码不足，调整起始位置
        if (end - start + 1 < MAX_PAGE_BUTTONS) {
            start = Math.max(1, end - MAX_PAGE_BUTTONS + 1);
        }

        // 添加第一页按钮
        if (start > 1) {
            buttons.push(
                <PageButton
                    key={1}
                    page={1}
                    currentPage={currentPage}
                    onPageChange={onPageChange}
                    dark={dark}
                />
            );
            // 添加起始省略号
            if (start > 2) {
                buttons.push(<Ellipsis key="start-ellipsis" dark={dark} />);
            }
        }

        // 添加中间页码按钮
        for (let i = start; i <= end; i++) {
            buttons.push(
                <PageButton
                    key={i}
                    page={i}
                    currentPage={currentPage}
                    onPageChange={onPageChange}
                    dark={dark}
                />
            );
        }

        // 添加最后一页按钮
        if (end < pages) {
            // 添加末尾省略号
            if (end < pages - 1) {
                buttons.push(<Ellipsis key="end-ellipsis" dark={dark} />);
            }
            buttons.push(
                <PageButton
                    key={pages}
                    page={pages}
                    currentPage={currentPage}
                    onPageChange={onPageChange}
                    dark={dark}
                />
            );
        }

        return buttons;
    }, [currentPage, pages, onPageChange, dark]);

    // 基础样式类（根据暗黑模式切换）
    const containerBase = dark
        ? "bg-gray-800 border-gray-700"
        : "bg-white border-gray-200";

    const buttonBase = dark
        ? "bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600 focus:ring-gray-400"
        : "bg-gray-200 text-gray-800 border-gray-300 hover:bg-gray-300 focus:ring-gray-400";

    const inputBase = dark
        ? "bg-gray-800 text-gray-100 border-gray-600 focus:ring-blue-500 focus:border-blue-500"
        : "bg-white text-gray-900 border-gray-300 focus:ring-blue-500 focus:border-blue-500";

    const textSecondary = dark ? "text-gray-400" : "text-gray-600";
    const textPrimary = dark ? "text-gray-100" : "text-gray-900";

    return (
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 p-4 ${containerBase} rounded-lg shadow-sm border`}>
            {/* 左侧：分页控制与总记录数 */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                {/* 分页导航 */}
                <nav
                    className="flex items-center gap-1"
                    role="navigation"
                    aria-label={t("pagination_aria_label", "Pagination")}
                >
                    {/* 上一页按钮 - 移动端只显示图标 */}
                    <button
                        onClick={handlePrev}
                        disabled={currentPage === 1}
                        className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md border ${buttonBase} disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${dark ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"}`}
                        aria-label={t("prev_page")}
                    >
                        <ChevronLeftIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">{t("prev_page")}</span>
                    </button>

                    {/* 页码按钮 - 仅在PC端显示 */}
                    <div className="hidden sm:flex items-center gap-1">
                        {getPageButtons()}
                    </div>

                    {/* 当前页信息 - 仅在移动端显示 */}
                    <div className={`sm:hidden flex items-center px-3 py-2 text-sm font-medium ${textPrimary} ${dark ? "bg-gray-700" : "bg-gray-50"} rounded-md`}>
                        {currentPage} / {pages}
                    </div>

                    {/* 下一页按钮 - 移动端只显示图标 */}
                    <button
                        onClick={handleNext}
                        disabled={currentPage === pages}
                        className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md border ${buttonBase} disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${dark ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"}`}
                        aria-label={t("next_page")}
                    >
                        <span className="hidden sm:inline">{t("next_page")}</span>
                        <ChevronRightIcon className="w-4 h-4 flex-shrink-0" />
                    </button>
                </nav>

                {/* 总记录数信息 */}
                <div className={`text-sm ${textSecondary} text-center sm:text-left whitespace-nowrap`}>
                    {t("total_name")} {total.toLocaleString()} {t("total_item")}
                </div>
            </div>

            {/* 右侧：快速跳转与每页数量 */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                {/* 快速跳转 */}
                <div className="flex items-center gap-1 w-full sm:w-auto">
                    <input
                        type="number"
                        min={1}
                        max={pages}
                        value={inputPage}
                        onChange={(e) => setInputPage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={`w-16 px-2 py-2 text-sm text-center border rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${inputBase} disabled:opacity-50 ${dark ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"}`}
                        aria-label={t("jump_page")}
                        placeholder={t("page_number", "页码")}
                    />
                    <button
                        onClick={handleJump}
                        className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md border ${buttonBase}`}
                    >
                        {t("jump_page")}
                    </button>
                </div>

                {/* 每页数量选择 */}
                <div className="flex items-center gap-1 w-full sm:w-auto">
                    <label htmlFor="per-page" className={`text-sm ${textSecondary} whitespace-nowrap`}>
                        {t("per_page")}
                    </label>
                    <select
                        id="per-page"
                        value={per_page}
                        onChange={(e) => onPerPageChange(Number(e.target.value))}
                        className={`px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${inputBase} disabled:opacity-50 ${dark ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"}`}
                        aria-label={t("per_page")}
                    >
                        {[5, 10, 20, 50, 100].map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}

/**
 * 页码按钮子组件
 */
function PageButton({ page, currentPage, onPageChange, dark }) {
    const { t } = useTranslation();
    const isActive = page === currentPage;

    const activeClasses = dark
        ? "bg-blue-600 text-white border-blue-600 focus:ring-blue-500"
        : "bg-blue-600 text-white border-blue-600 focus:ring-blue-500";

    const inactiveClasses = dark
        ? "bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600 focus:ring-blue-500"
        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:ring-blue-500";

    return (
        <button
            onClick={() => onPageChange(page)}
            className={`min-w-[2.5rem] px-3 py-2 text-sm font-medium rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                isActive ? activeClasses : inactiveClasses
            } ${dark ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"}`}
            aria-current={isActive ? "page" : undefined}
            aria-label={`${t("page_number", "Page")} ${page}`}
        >
            {page}
        </button>
    );
}

/**
 * 省略号组件
 */
function Ellipsis({ dark }) {
    return (
        <span className={`px-2 py-2 text-sm ${dark ? "text-gray-500" : "text-gray-500"} select-none`} aria-hidden="true">
      ...
    </span>
    );
}
