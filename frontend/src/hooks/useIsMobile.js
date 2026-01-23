import {useEffect, useState} from 'react';

// 定义移动端断点。这应该与您的 Tailwind CSS 配置中的 'md' 断点保持一致。
// Tailwind 的默认 'md' 断点是 768px。
const MOBILE_BREAKPOINT = 768;

/**
 * 自定义 Hook，用于判断当前视口是否被认为是移动设备。
 * @returns {boolean} 如果视口宽度小于 MOBILE_BREAKPOINT，则返回 true，否则返回 false。
 */
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // 检查并更新移动设备状态的函数
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        // 组件挂载时进行初始检查
        checkIsMobile();

        // 添加窗口大小调整事件监听器，以便动态更新状态
        window.addEventListener('resize', checkIsMobile);

        // 清理函数：在组件卸载时移除事件监听器
        return () => {
            window.removeEventListener('resize', checkIsMobile);
        };
    }, []); // 空依赖数组确保此 effect 只在挂载和卸载时运行一次

    return isMobile;
}
