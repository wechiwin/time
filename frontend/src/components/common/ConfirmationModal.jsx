import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

// 一个简单的 SVG 加载动画图标
const LoadingSpinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export default function ConfirmationModal({
                                              isOpen,
                                              onClose,
                                              onConfirm,
                                              title,
                                              description,
                                              confirmText,
                                              cancelText,
                                              isLoading = false,
                                              isDestructive = true, // 默认为破坏性操作，按钮显示为红色
                                          }) {
    const { t } = useTranslation();

    // 根据是否为破坏性操作决定确认按钮的样式
    const confirmButtonClass = isDestructive
        ? 'btn-danger'
        : 'btn-primary';

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={isLoading ? () => {} : onClose}>
                {/* 遮罩层 */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black bg-opacity-40" />
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
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl card p-6 text-left align-middle shadow-xl transition-all">
                                <div className="sm:flex sm:items-start">
                                    {isDestructive && (
                                        <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                                            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                                        </div>
                                    )}
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                        <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 dark:text-gray-100">
                                            {title}
                                        </Dialog.Title>
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                                                {description}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* 按钮区域 */}
                                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="button"
                                        className={`inline-flex w-full justify-center sm:ml-3 sm:w-auto ${confirmButtonClass}`}
                                        onClick={onConfirm}
                                        disabled={isLoading}
                                    >
                                        {isLoading && <LoadingSpinner />}
                                        {confirmText || t('button_confirm')}
                                    </button>
                                    <button
                                        type="button"
                                        className="mt-3 inline-flex w-full justify-center btn-secondary sm:mt-0 sm:w-auto"
                                        onClick={onClose}
                                        disabled={isLoading}
                                    >
                                        {cancelText || t('button_cancel')}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
