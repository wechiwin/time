// src/components/common/Pagination.jsx
import React, {useEffect, useState} from "react";
import PaginationPC from "./PaginationPC";
import PaginationMobile from "./PaginationMobile";

// 定义移动端/PC端的断点 (对应 Tailwind 的 sm 断点)
const MOBILE_BREAKPOINT = 640;

export default function Pagination(props) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // 初始检查
        const checkIsMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        checkIsMobile();

        // 监听窗口变化
        window.addEventListener("resize", checkIsMobile);
        return () => window.removeEventListener("resize", checkIsMobile);
    }, []);

    // 根据设备类型渲染不同的组件
    // 将 props 原样传递下去
    return isMobile ? <PaginationMobile {...props} /> : <PaginationPC {...props} />;
}