// src/utils/formValidation.js

/**
 * 验证必填字段
 * @param {Object} formData 表单数据
 * @param {Array} requiredFields 必填字段列表 ['name', 'detail.age']
 * @param {Function} t i18n翻译函数
 * @returns {Object} 错误对象 { "ho_code": "不能为空", "fund_detail.rate": "不能为空" }
 */
export const validateForm = (formData, requiredFields, t) => {
    const newErrors = {};
    let isValid = true;

    requiredFields.forEach(field => {
        // 处理嵌套对象字段 (例如: fund_detail.manage_exp_rate)
        const fieldPath = field.split('.');
        let value = formData;

        for (const path of fieldPath) {
            value = value?.[path];
            if (value === undefined) break;
        }

        // 验证逻辑：空字符串、null、undefined 视为错误 (0 视为有效)
        if (value === '' || value === null || value === undefined) {
            // 记录错误信息
            newErrors[field] = t('field_cannot_be_empty');
            isValid = false;
        }
    });

    return {isValid, errors: newErrors};
};
