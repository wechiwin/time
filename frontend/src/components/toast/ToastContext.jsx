import React, {createContext, useState, useCallback, useContext, useRef, useEffect} from 'react';
import Toast from './Toast';
import {useTranslation} from "react-i18next";

const ToastContext = createContext(null);

export const TOAST_TYPE = {
    SUCCESS: 'success',
    ERROR: 'error',
    INFO: 'info',
    WARNING: 'warning',
};

export function ToastProvider({children}) {
    const {t} = useTranslation()
    const [toast, setToast] = useState(null);
    const timeoutRef = useRef(null);
    const defaultDuration = 3000;

    const showToast = useCallback((type, message, duration = defaultDuration) => {
        if (!Object.values(TOAST_TYPE).includes(type)) {
            console.warn(`Invalid toast type: ${type}`);
            type = TOAST_TYPE.ERROR;
            message = '未知的提示类型';
        }

        setToast({type, message});

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setToast(null);
            timeoutRef.current = null;
        }, duration);
    }, []);

    const showSuccessToast = useCallback((customMessage) => {
        const successMsg = t('msg_operation_success');
        const message = customMessage ? `${successMsg}: ${customMessage}` : successMsg;
        showToast(TOAST_TYPE.SUCCESS, message);
    }, [showToast, t]);

    const showErrorToast = useCallback((customMessage) => {
        const failureMsg = t('msg_operation_failed');
        const message = customMessage ? `${failureMsg}: ${customMessage}` : failureMsg;
        showToast(TOAST_TYPE.ERROR, message);
    }, [showToast, t]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <ToastContext.Provider value={{showToast, showSuccessToast, showErrorToast}}>
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