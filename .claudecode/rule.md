# CRITICAL: Code Change Protocol

**Rule: Before executing any `write_to_file` or `edit_file` tool, you MUST perform the following:**

1. **Discovery Phase:**
    - Identify all states/scenarios in the requirement.
    - Map current code handling vs. desired handling.

2. **Analysis Output:**
    - Briefly explain: What changes are needed, and why?
    - Confirm no "patch-based" or incremental fixes without full context.

3. **Implementation & Verification:**
    - Implement the complete state matrix at once.
    - Verify that no existing functionality is broken.