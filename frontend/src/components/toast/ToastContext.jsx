import React, { createContext, useState, useCallback, useContext, useRef, useEffect } from 'react';
import Toast from './Toast';

const ToastContext = createContext(null);

export const TOAST_TYPE = {
    SUCCESS: 'success',
    ERROR: 'error',
    INFO: 'info',
    WARNING: 'warning',
};

export const TOAST_MESSAGE = {
    SUCCESS: '操作成功',
    FAILURE: '操作失败',
};

export function ToastProvider({ children }) {
    const [toast, setToast] = useState(null);
    const timeoutRef = useRef(null);
    const defaultDuration = 3000;

    const showToast = useCallback((type, message, duration = defaultDuration) => {
        if (!Object.values(TOAST_TYPE).includes(type)) {
            console.warn(`Invalid toast type: ${type}`);
            type = TOAST_TYPE.ERROR;
            message = '未知的提示类型';
        }

        setToast({ type, message });

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setToast(null);
            timeoutRef.current = null;
        }, duration);
    }, []);

    const showSuccessToast = useCallback((customMessage) => {
        const message = customMessage ? `${TOAST_MESSAGE.SUCCESS}: ${customMessage}` : TOAST_MESSAGE.SUCCESS;
        showToast(TOAST_TYPE.SUCCESS, message);
    }, [showToast]);

    const showErrorToast = useCallback((customMessage) => {
        const message = customMessage ? `${TOAST_MESSAGE.FAILURE}: ${customMessage}` : TOAST_MESSAGE.FAILURE;
        showToast(TOAST_TYPE.ERROR, message);
    }, [showToast]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, showSuccessToast, showErrorToast }}>
            {children}
            {toast && (
                <Toast
                    type={toast.type}
                    message={toast.message}
                    onClose={() => {
                        setToast(null);
                        if (timeoutRef.current) {
                            clearTimeout(timeoutRef.current);
                        }
                    }}
                />
            )}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}