import {useState} from "react";
import {Dialog, Transition} from "@headlessui/react";
import {ExclamationTriangleIcon} from "@heroicons/react/24/outline";

export default function DeleteConfirmation({
                                               buttonText = "删除",
                                               title = "确认删除",
                                               description = "确定要删除这条记录吗？此操作不可撤销。",
                                               confirmText = "确认删除",
                                               cancelText = "取消",
                                               onConfirm,
                                               onCancel,
                                               children,
                                           }) {
    const [isOpen, setIsOpen] = useState(false);

    const handleConfirm = () => {
        onConfirm?.(); // 执行传入的确认回调
        setIsOpen(false);
    };

    const handleCancel = () => {
        onCancel?.(); // 执行传入的取消回调
        setIsOpen(false);
    };

    return (
        <>
            {/* 触发按钮 - 可通过 children 自定义 */}
            {children ? (
                <div onClick={() => setIsOpen(true)}>{children}</div>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                >
                    {buttonText}
                </button>
            )}

            {/* 弹窗 */}
            <Transition show={isOpen} as="div">
                <Dialog onClose={() => setIsOpen(false)} className="relative z-50">
                    {/* 遮罩层 */}
                    <Transition.Child
                        as="div"
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                        className="fixed inset-0 bg-black/30"
                    />

                    {/* 弹窗内容 */}
                    <div className="fixed inset-0 flex items-center justify-center p-4">
                        <Transition.Child
                            as="div"
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                            className="w-full max-w-md"
                        >
                            <Dialog.Panel className="bg-white rounded-lg shadow-xl overflow-hidden">
                                <div className="p-6">
                                    <div className="flex items-start">
                                        <div className="flex-shrink-0">
                                            <ExclamationTriangleIcon
                                                className="h-6 w-6 text-red-600"
                                                aria-hidden="true"
                                            />
                                        </div>
                                        <div className="ml-4">
                                            <Dialog.Title
                                                as="h3"
                                                className="text-lg font-medium text-gray-900"
                                            >
                                                {title}
                                            </Dialog.Title>
                                            <div className="mt-2">
                                                <p className="text-sm text-gray-500">{description}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                                    >
                                        {cancelText}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirm}
                                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                                    >
                                        {confirmText}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </Dialog>
            </Transition>
        </>
    );
}