---
description: 强化错误处理、日志记录和生产环境安全性
globs: ["**/*.{js,ts,jsx,tsx,py,go}"]
---

# Robustness & Error Handling

**Rule: Code must be "Production-Ready," not just "Working-Demo."**

## 1. Graceful Degradation
- **API Calls:** Every async call MUST have a `try-catch` block and a meaningful user-facing error message (using i18n).
- **Null Safety:** Always use optional chaining (`?.`) or null checks when accessing deeply nested objects.

## 2. Meaningful Logging
- Avoid `console.log("here")`. Use structured logging that includes context (e.g., `console.error("[AuthModule] Login failed:", error)`).
- **Security:** NEVER log sensitive data like passwords, tokens, or PII (Personally Identifiable Information).