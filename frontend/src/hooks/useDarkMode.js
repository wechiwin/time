// src/hooks/useDarkMode.js
import {useDarkModeContext} from "../components/common/DarkModeContext";

export default function useDarkMode() {
    const { isDarkMode, toggleDarkMode } = useDarkModeContext();

    return {
        dark: isDarkMode,
        toggle: toggleDarkMode
    };
}
