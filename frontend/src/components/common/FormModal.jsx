// src/components/common/FormModal.jsx
import Modal from './Modal';
import PropTypes from 'prop-types';

export default function FormModal({
                                      title,
                                      show,
                                      onClose,
                                      onSubmit = () => {
                                      },
                                      FormComponent,
                                      initialValues = {},
                                      modalProps = {},
                                  }) {
    // 添加安全检查
    const handleSubmit = async (values) => {
        if (typeof onSubmit === 'function') {
            await onSubmit(values);
            onClose();
        } else {
            console.error('onSubmit is not a function');
            onClose();
        }
    };

    return (
        <Modal title={title} show={show} onClose={onClose}>
            <FormComponent
                onSubmit={handleSubmit}
                onClose={onClose}
                initialValues={initialValues}
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
};