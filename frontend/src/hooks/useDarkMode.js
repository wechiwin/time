// src/hooks/useDarkMode.js
import {useDarkModeContext} from "../components/context/DarkModeContext";

export default function useDarkMode() {
    const { isDarkMode, toggleDarkMode } = useDarkModeContext();

    return {
        dark: isDarkMode,
        toggle: toggleDarkMode
    };
}
