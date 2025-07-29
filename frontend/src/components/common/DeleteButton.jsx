// src/components/common/DeleteButton.jsx
import { useState } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { Dialog } from '@headlessui/react';

export default function DeleteButton({ onConfirm, description }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="text-red-600 hover:text-red-800"
            >
                <TrashIcon className="w-5 h-5" />
            </button>

            <Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
                <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="bg-white rounded p-6 max-w-sm w-full">
                        <Dialog.Title className="font-semibold mb-2">确认删除</Dialog.Title>
                        <p className="text-sm text-gray-600 mb-4">{description}</p>
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setOpen(false)} className="btn-secondary">取消</button>
                            <button
                                onClick={() => {
                                    onConfirm();
                                    setOpen(false);
                                }}
                                className="btn-danger"
                            >
                                删除
                            </button>
                        </div>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </>
    );
}