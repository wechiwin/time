// src/components/common/Modal.jsx
import PropTypes from 'prop-types';

export default function Modal({title, show, onClose, children, width}) {
    if (!show) return null;

    // 双模式：传了 width 就用固定宽度，否则自适应
    const modalWidthClass = width
        ? width
        : "w-auto max-w-[90%]";

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 ${modalWidthClass}`}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                        ×
                    </button>
                </div>
                {children}
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