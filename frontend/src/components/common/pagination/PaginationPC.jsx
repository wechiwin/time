// src/components/common/PaginationPC.jsx
import React, {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {ChevronLeftIcon, ChevronRightIcon} from "@heroicons/react/24/solid";
import clsx from 'clsx';
import useDarkMode from "../../../hooks/useDarkMode";

const MAX_PAGE_BUTTONS = 5;

function PageButton({page, currentPage, onPageChange}) {
    const {t} = useTranslation();
    const isActive = page === currentPage;

    return (
        <button
            onClick={() => onPageChange(page)}
            className={clsx(
                "min-w-[2.5rem] px-3 py-2 text-sm font-medium rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors",
                "focus:ring-blue-500 dark:focus:ring-offset-gray-900",
                {
                    'bg-blue-600 text-white border-blue-600': isActive,
                    'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600': !isActive,
                }
            )}
            aria-current={isActive ? "page" : undefined}
            aria-label={`${t("page_number", "Page")} ${page}`}
        >
            {page}
        </button>
    );
}

function Ellipsis() {
    return (
        <span className="px-2 py-2 text-sm text-gray-500 select-none" aria-hidden="true">
            ...
        </span>
    );
}

export default function PaginationPC({pagination, onPageChange, onPerPageChange}) {
    if (!pagination || pagination.pages <= 1) return null;

    const {page = 1, per_page = 10, total = 0, pages = 1} = pagination;
    const [inputPage, setInputPage] = useState(page);
    const {t} = useTranslation();
    const {dark} = useDarkMode();

    useEffect(() => {
        setInputPage(page);
    }, [page]);

    const currentPage = Math.min(page, pages);

    const handlePrev = useCallback(() => {
        if (currentPage > 1) onPageChange(currentPage - 1);
    }, [currentPage, onPageChange]);

    const handleNext = useCallback(() => {
        if (currentPage < pages) onPageChange(currentPage + 1);
    }, [currentPage, pages, onPageChange]);

    const handleJump = useCallback(() => {
        let p = parseInt(inputPage, 10);
        if (!isNaN(p)) {
            p = Math.max(1, Math.min(p, pages));
            if (p !== currentPage) {
                onPageChange(p);
            } else {
                setInputPage(p);
            }
        }
    }, [inputPage, currentPage, pages, onPageChange]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleJump();
        }
    }, [handleJump]);

    const getPageButtons = useCallback(() => {
        const buttons = [];
        const half = Math.floor(MAX_PAGE_BUTTONS / 2);
        let start = Math.max(1, currentPage - half);
        let end = Math.min(pages, start + MAX_PAGE_BUTTONS - 1);

        if (end - start + 1 < MAX_PAGE_BUTTONS) {
            start = Math.max(1, end - MAX_PAGE_BUTTONS + 1);
        }

        if (start > 1) {
            buttons.push(<PageButton key={1} page={1} currentPage={currentPage} onPageChange={onPageChange}/>);
            if (start > 2) buttons.push(<Ellipsis key="start-ellipsis"/>);
        }

        for (let i = start; i <= end; i++) {
            buttons.push(<PageButton key={i} page={i} currentPage={currentPage} onPageChange={onPageChange}/>);
        }

        if (end < pages) {
            if (end < pages - 1) buttons.push(<Ellipsis key="end-ellipsis"/>);
            buttons.push(<PageButton key={pages} page={pages} currentPage={currentPage} onPageChange={onPageChange}/>);
        }

        return buttons;
    }, [currentPage, pages, onPageChange]);

    // 样式类定义
    const baseButtonClasses = "inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    const navButtonClasses = `${baseButtonClasses} ${dark ? "bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600 focus:ring-gray-400 focus:ring-offset-gray-900" : "bg-gray-200 text-gray-800 border-gray-300 hover:bg-gray-300 focus:ring-gray-400 focus:ring-offset-white"}`;
    const jumpButtonClasses = `${baseButtonClasses} ${dark ? "bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600 focus:ring-blue-500 focus:ring-offset-gray-900" : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100 focus:ring-blue-500 focus:ring-offset-white"}`;
    const inputClasses = `w-16 px-2 py-2 text-sm text-center border rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${dark ? "bg-gray-800 text-gray-100 border-gray-600 focus:ring-blue-500 focus:border-blue-500 focus:ring-offset-gray-900" : "bg-white text-gray-900 border-gray-300 focus:ring-blue-500 focus:border-blue-500 focus:ring-offset-white"}`;
    const selectClasses = `px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${dark ? "bg-gray-800 text-gray-100 border-gray-600 focus:ring-blue-500 focus:border-blue-500 focus:ring-offset-gray-900" : "bg-white text-gray-900 border-gray-300 focus:ring-blue-500 focus:border-blue-500 focus:ring-offset-white"}`;

    return (
        <div className={clsx(
            "flex flex-wrap items-center justify-between gap-x-6 gap-y-4 mt-6 p-4 rounded-lg shadow-sm border",
            dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
            {/* 左侧：分页导航和总数 */}
            <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
                <nav className="flex items-center gap-1" role="navigation" aria-label={t("pagination_aria_label", "Pagination")}>
                    <button onClick={handlePrev} disabled={currentPage === 1} className={navButtonClasses} aria-label={t("prev_page")}>
                        <ChevronLeftIcon className="w-4 h-4"/>
                        <span>{t("prev_page")}</span>
                    </button>

                    {/* PC端直接展示页码按钮，不再需要 hidden sm:flex */}
                    <div className="flex items-center gap-1">{getPageButtons()}</div>

                    <button onClick={handleNext} disabled={currentPage === pages} className={navButtonClasses} aria-label={t("next_page")}>
                        <span>{t("next_page")}</span>
                        <ChevronRightIcon className="w-4 h-4"/>
                    </button>
                </nav>
                <div className={clsx("text-sm whitespace-nowrap", dark ? "text-gray-400" : "text-gray-600")}>
                    {t("total_name")} {total.toLocaleString()} {t("total_item")}
                </div>
            </div>

            {/* 右侧：快速跳转与每页数量 */}
            <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
                <div className="flex items-center gap-1">
                    <input
                        type="number"
                        min={1}
                        max={pages}
                        value={inputPage}
                        onChange={(e) => setInputPage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={inputClasses}
                        aria-label={t("jump_page")}
                        placeholder={t("page_number", "页码")}
                    />
                    <button onClick={handleJump} className={jumpButtonClasses}>
                        {t("jump_page")}
                    </button>
                </div>

                <div className="flex items-center gap-1">
                    <select
                        id="per-page-pc"
                        value={per_page}
                        onChange={(e) => onPerPageChange(Number(e.target.value))}
                        className={selectClasses}
                        aria-label={t("per_page")}
                    >
                        {[5, 10, 20, 50, 100].map((n) => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                    <label htmlFor="per-page-pc" className={clsx("text-sm ml-1", dark ? "text-gray-400" : "text-gray-600")}>
                        {t("items_per_page", "条/页")}
                    </label>
                </div>
            </div>
        </div>
    );
}