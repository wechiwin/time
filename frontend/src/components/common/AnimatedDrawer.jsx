// src/components/common/AnimatedDrawer.jsx
import { AnimatePresence, motion } from 'framer-motion';

export default function AnimatedDrawer({ open, onClose, children }) {
    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* 遮罩 淡入淡出 */}
                    <motion.div
                        key="mask"
                        className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    {/* 内容 从右滑入*/}
                    <motion.div
                        key="drawer"
                        className="fixed right-0 top-0 z-30 h-full w-full md:w-[600px] lg:w-[700px] bg-white shadow-2xl"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    >
                        {children}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}