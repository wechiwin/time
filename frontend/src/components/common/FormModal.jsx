// src/components/common/FormModal.jsx
import { useState } from 'react';
import Modal from './Modal';
import PropTypes from 'prop-types';

export default function FormModal({
                                      title,
                                      show,
                                      onClose,
                                      onSubmit = () => {},
                                      FormComponent,
                                      initialValues = {},
                                      modalProps = {},
                                  }) {
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (values) => {
        if (typeof onSubmit !== 'function') {
            console.error('onSubmit is not a function');
            return;
        }

        setSubmitting(true);
        try {
            const result = await onSubmit(values);
            // 只有显式返回 true 或 { success: true } 时才关闭
            if (result === true || result?.success) {
                onClose();
            }
        } catch (error) {
            console.error('Form submission error:', error);
            // 错误处理由 onSubmit 内部完成，这里不自动关闭
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title={title}
            show={show}
            onClose={onClose}
            disableClose={submitting} // 防止提交过程中意外关闭
        >
            <FormComponent
                onSubmit={handleSubmit}
                onClose={onClose}
                initialValues={initialValues}
                submitting={submitting} // 传递提交状态给表单
                {...modalProps}
            />
        </Modal>
    );
}

FormModal.propTypes = {
    title: PropTypes.string.isRequired,
    show: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSubmit: PropTypes.func,
    FormComponent: PropTypes.elementType.isRequired,
    initialValues: PropTypes.object,
    modalProps: PropTypes.object,
};