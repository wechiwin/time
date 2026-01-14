// utils/toastInstance.js
class ToastInstance {
    constructor() {
        this.callbacks = {
            showSuccessToast: null,
            showErrorToast: null
        };
    }

    setCallbacks(callbacks) {
        this.callbacks = callbacks;
    }

    showSuccessToast(message) {
        if (this.callbacks.showSuccessToast) {
            this.callbacks.showSuccessToast(message);
        } else {
            console.warn('Toast callbacks not set');
        }
    }

    showErrorToast(message) {
        if (this.callbacks.showErrorToast) {
            this.callbacks.showErrorToast(message);
        } else {
            console.warn('Toast callbacks not set');
        }
    }
}

export const toastInstance = new ToastInstance();
