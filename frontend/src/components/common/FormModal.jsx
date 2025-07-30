// src/components/common/FormModal.jsx
import Modal from './Modal';
import PropTypes from 'prop-types';

export default function FormModal({
                                      title,
                                      show,
                                      onClose,
                                      onSubmit,
                                      FormComponent,
                                      initialValues,
                                  }) {
    return (
        <Modal title={title} show={show} onClose={onClose}>
            <FormComponent
                onSubmit={async (values) => {
                    await onSubmit(values);
                    onClose();
                }}
                onClose={onClose}
                initialValues={initialValues}
            />
        </Modal>
    );
}

FormModal.propTypes = {
    title: PropTypes.string.isRequired,
    show: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    FormComponent: PropTypes.elementType.isRequired,
    initialValues: PropTypes.object,
};