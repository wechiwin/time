---
description: 国际化协议：严禁硬编码字符串，必须使用 i18n
globs: ["**/*.{js,ts,jsx,tsx,vue,py,go,java,html}"]
---

# Internationalization (i18n) Protocol

**Rule: Hardcoded user-facing strings are FORBIDDEN.**

## 1. Detection
- Audit all new or modified strings in both Frontend (UI text) and Backend (error messages/notifications).

## 2. Implementation
### 1. Frontend (React)
- Use `useTranslation` hook or `t` function from `react-i18next`.
- **Action:** Check `public/locales/` or `src/i18n/` for existing keys before adding new ones.

### 2. Backend (Flask)
- Use `flask_babel` for localizing error messages and notifications.
- Use `gettext` or `_()` for wrapping strings.
- **Action:** Check `backend/translations` for existing keys before adding new ones.

## 3. Review Step
- Before finishing, list all new i18n keys created in both frontend and backend to ensure they match.