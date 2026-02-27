---
description: 逻辑变更核心协议：要求先思考、分析边界情况，严禁盲目修改
globs: ["**/*.{js,ts,jsx,tsx,vue,py,go,java,c,cpp,rb,php}"]
---

# CRITICAL: Logic & Boundary Protocol

**Rule: You MUST complete the thinking process before any `write_to_file` or `edit_file` call.**

## 1. Discovery & Edge Case Analysis
- **Identify Scenarios:** Map out all possible states, including success, failure, null/undefined, and extreme inputs.
- **Deep Thinking:** Explicitly analyze how the change affects existing logic flows. **Think through the logic completely before writing any code.**

## 2. Analysis Output Requirement
- **Wait!** Before coding, briefly state:
    - What is the core logic change?
    - Which edge cases were identified?
    - How will you handle them?
- **No Patching:** Implement the complete state matrix at once. No incremental fixes without full context.