// src/components/common/Modal.jsx
import {Fragment} from 'react';
import PropTypes from 'prop-types';
import {Dialog, Transition} from '@headlessui/react';

export default function Modal({title, show, onClose, children, width}) {
    const modalStyleClass = width
        ? width
        : "w-[90%] md:w-auto md:max-w-[90%]";

    return (
        <Transition appear show={show} as={Fragment}>
            <Dialog as="div" className="relative z-modal" onClose={onClose}>
                {/* 背景遮罩层 */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50"/>
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel
                                // [!code focus]
                                // FIX: Set a base text color for the entire panel to ensure consistency for all content.
                                className={`transform overflow-hidden rounded-xl bg-white dark:bg-gray-800 text-left align-middle shadow-2xl transition-all flex flex-col ${modalStyleClass} max-h-[90vh] text-gray-900 dark:text-gray-100`}
                            >
                                {/* 头部 */}
                                <div
                                    className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                                    <Dialog.Title
                                        as="h2"
                                        className="text-lg font-semibold leading-6" // Color is now inherited from Dialog.Panel
                                    >
                                        {title}
                                    </Dialog.Title>
                                    <button
                                        onClick={onClose}
                                        className="text-gray-500 hover:text-gray-700 dark:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        aria-label="Close modal"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
                                             viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M6 18L18 6M6 6l12 12"/>
                                        </svg>
                                    </button>
                                </div>

                                {/* 内容区域 */}
                                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                                    {children}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

Modal.propTypes = {
    title: PropTypes.string.isRequired,
    show: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    children: PropTypes.node.isRequired,
    width: PropTypes.string,
};
