// MySelect.jsx
import React, {useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';

const usePrevious = (value) => {
    const ref = useRef();
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
};

const MySelect = ({
                      options = [],
                      value,
                      onChange,
                      placeholder = '请选择',
                      required = false,
                      className = '',
                      autoSelectFirst = true,
                      disabled = false,
                      ...rest
                  }) => {
    const prevOptions = usePrevious(options);
    const [initialized, setInitialized] = useState(false);

    // 优化后的 useEffect，只在 options 从空变为非空时执行一次
    useEffect(() => {
        if (!autoSelectFirst || !onChange || initialized || options.length === 0) return;

        // 只在 options 首次加载完成且当前值为空时自动选择第一项
        if (options.length > 0 && (!value || value === '')) {
            // 使用 setTimeout 避免在渲染过程中调用 setState
            const timer = setTimeout(() => {
                onChange(options[0].value);
                setInitialized(true);
            }, 0);

            return () => clearTimeout(timer);
        }

        setInitialized(true);
    }, [options, value, onChange, autoSelectFirst, initialized]);

    // 处理用户手动选择
    const handleChange = (e) => {
        if (onChange) {
            onChange(e.target.value);
        }
    };

    // 如果没有选项，显示加载中或暂无数据状态
    if (options.length === 0) {
        return (
            <select
                disabled
                className={`${className} opacity-50 cursor-not-allowed`}
                {...rest}
            >
                <option value="">加载中...</option>
            </select>
        );
    }

    return (
        <select
            value={value || ''}
            onChange={handleChange}
            required={required}
            disabled={disabled}
            className={`${className} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            {...rest}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
};

MySelect.propTypes = {
    options: PropTypes.arrayOf(
        PropTypes.shape({
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
            label: PropTypes.string.isRequired,
        })
    ).isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    required: PropTypes.bool,
    className: PropTypes.string,
    autoSelectFirst: PropTypes.bool,
    disabled: PropTypes.bool,
};

export default MySelect;
