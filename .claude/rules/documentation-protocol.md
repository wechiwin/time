---
description: 要求生成自解释的代码和必要的文档注释
globs: ["**/*.{js,ts,jsx,tsx,py,go}"]
---

# Documentation & Readability

**Rule: Code must be self-documenting and include JSDoc/Docstrings for complex logic.**

## 1. The "Why," Not the "What"
- Don't comment `i++; // increment i`.
- **DO** comment why a specific logic choice was made, especially if it's a workaround for a known bug or a complex business rule.

## 2. API Documentation
- For every new function, provide a brief JSDoc/Docstring including:
    - What it does.
    - Parameters and types.
    - Return value.