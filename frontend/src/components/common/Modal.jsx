// src/components/common/Modal.jsx
import PropTypes from 'prop-types';

export default function Modal({ title, show, onClose, children, width }) {
    if (!show) return null;

    // 1. 如果传了 width，使用固定宽度。
    // 2. 如果没传 width：
    //    - 桌面端：自适应大小，最大 90%。
    //    - 移动端：宽度占满 90% 左右，保持居中。
    const modalStyleClass = width
        ? width
        : "w-[90%] md:w-auto md:max-w-[90%]";

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 transition-opacity duration-300 p-4">
            <div
                className={`bg-white dark:bg-gray-800 shadow-2xl flex flex-col rounded-xl ${modalStyleClass} max-h-[90vh]`}
            >
                {/* 头部 */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 内容区域：允许滚动 */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}

Modal.propTypes = {
    title: PropTypes.string.isRequired,
    show: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    children: PropTypes.node.isRequired,
    width: PropTypes.string,
};
