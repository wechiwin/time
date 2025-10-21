// src/hooks/usePaginationState.js
import {useState} from "react";
import {DEFAULT_PAGE_SIZE} from "../constants/sysConst";

export function usePaginationState(initial = {page: 1, perPage: DEFAULT_PAGE_SIZE}) {
    const [page, setPage] = useState(initial.page);
    const [perPage, setPerPage] = useState(initial.perPage);

    // 处理页码变化
    const handlePageChange = (p) => setPage(p);
    // 处理每页数量变化
    const handlePerPageChange = (n) => {
        setPerPage(n);
        setPage(1); // 修改每页数量时重置到第一页
    };

    return {page, perPage, handlePageChange, handlePerPageChange};
}
