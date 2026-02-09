// src/components/common/PaginationMobile.jsx
import React, {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {ChevronLeftIcon, ChevronRightIcon} from "@heroicons/react/24/solid";
import useDarkMode from "../../../hooks/useDarkMode";
import clsx from "clsx";

export default function PaginationMobile({pagination, onPageChange}) {
    // 移动端通常不提供 onPerPageChange 的 UI，但保留接口以备不时之需，或者默认使用父组件传来的 per_page
    if (!pagination || pagination.pages <= 1) return null;

    const {page = 1, total = 0, pages = 1} = pagination;
    const {t} = useTranslation();
    const {dark} = useDarkMode();

    const currentPage = Math.min(page, pages);

    const handlePrev = useCallback(() => {
        if (currentPage > 1) onPageChange(currentPage - 1);
    }, [currentPage, onPageChange]);

    const handleNext = useCallback(() => {
        if (currentPage < pages) onPageChange(currentPage + 1);
    }, [currentPage, pages, onPageChange]);

    // 样式定义：移动端按钮点击区域需要稍大一些方便点击
    const navButtonClasses = clsx(
        "inline-flex items-center justify-center w-10 h-10 rounded-full border focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        dark
            ? "bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600 focus:ring-gray-400 focus:ring-offset-gray-900"
            : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100 focus:ring-gray-400 focus:ring-offset-white shadow-sm"
    );

    return (
        <div className={clsx(
            "flex items-center justify-between mt-4 py-2", // 减少左右 padding，充分利用空间
            // 背景色可选，如果需要卡片感可以取消注释下一行
            // dark ? "bg-gray-800" : "bg-white"
        )}>
            {/* 左侧：上一页 */}
            <button
                onClick={handlePrev}
                disabled={currentPage === 1}
                className={navButtonClasses}
                aria-label={t("prev_page")}
            >
                <ChevronLeftIcon className="w-5 h-5"/>
            </button>

            {/* 中间：页码信息 */}
            <div className="flex flex-col items-center">
                <span className={clsx(
                    "text-sm font-medium",
                    dark ? "text-gray-200" : "text-gray-900"
                )}>
                    {currentPage} / {pages}
                </span>
                <span className={clsx(
                    "text-xs mt-0.5",
                    dark ? "text-gray-400" : "text-gray-500"
                )}>
                    {t("total_name")} {total.toLocaleString()}
                </span>
            </div>

            {/* 右侧：下一页 */}
            <button
                onClick={handleNext}
                disabled={currentPage === pages}
                className={navButtonClasses}
                aria-label={t("next_page")}
            >
                <ChevronRightIcon className="w-5 h-5"/>
            </button>
        </div>
    );
}