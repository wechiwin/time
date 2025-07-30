// src/hooks/useDarkMode.js
import { useEffect, useState } from 'react';

export default function useDarkMode() {
    const [dark, setDark] = useState(() => {
        // 1. 先看 localStorage
        const saved = localStorage.getItem('dark');
        if (saved !== null) return saved === 'true';
        // 2. 再看系统
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (dark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('dark', dark);
    }, [dark]);

    const toggle = () => setDark((prev) => !prev);

    return { dark, toggle };
}