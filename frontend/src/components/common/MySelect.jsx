// MySelect.jsx
import React, {useEffect} from 'react';
import PropTypes from 'prop-types';

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
    useEffect(() => {
        if (
            autoSelectFirst &&
            onChange &&
            options.length > 0 &&
            (value == null || value === '')
        ) {
            onChange(options[0].value);
        }
    }, [options, value, onChange, autoSelectFirst]);

    const handleChange = (e) => {
        onChange?.(e.target.value);
    };

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
            value={value ?? ''}
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
