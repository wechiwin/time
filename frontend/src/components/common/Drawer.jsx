import { motion, AnimatePresence } from 'framer-motion';

export default function Drawer({ open, onClose, children }) {
    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        className="fixed inset-0 bg-black/30 z-40"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />
                    <motion.div
                        className="fixed right-0 top-0 w-96 h-full bg-white dark:bg-gray-900 shadow-xl z-50"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween' }}
                    >
                        <div className="p-4 flex justify-between border-b dark:border-gray-700">
                            <h2 className="font-semibold">详情</h2>
                            <button onClick={onClose}>✕</button>
                        </div>
                        <div className="p-4 overflow-y-auto h-[calc(100%-48px)]">{children}</div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
