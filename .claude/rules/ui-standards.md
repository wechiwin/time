---
description: 前端开发准则：必须适配暗黑模式、移动端响应式
globs: ["**/*.{jsx,tsx,vue,html,css,scss,less,styled-components.ts}"]
---

# UI/UX Implementation Standards

**Rule: Every frontend UI change MUST satisfy modern compatibility requirements.**

## 1. Dark Mode Adaptation
- **Requirement:** Check if the project uses CSS variables, Tailwind dark classes, or themed JSON.
- **Action:** Ensure new/modified elements look correct in both Light and Dark themes. **Never hardcode hex colors** unless they are theme-agnostic.

## 2. Mobile-First Responsiveness
- **Requirement:** Verify layout on small screens.
- **Action:** Use media queries, flexbox, or grid to ensure the UI does not break on mobile devices.

## 3. UI Components
- Use `Tailwind CSS` for styling.
- Use `@headlessui/react` for complex UI components (modals, dropdowns) to ensure accessibility.
- Use `framer-motion` for animations.