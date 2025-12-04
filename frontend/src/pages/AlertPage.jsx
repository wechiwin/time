import {useState, useCallback} from 'react';
import AlertRuleTable from '../components/tables/AlertRuleTable';
import AlertHistoryTable from '../components/tables/AlertHistoryTable';
import AlertRuleForm from '../components/forms/AlertRuleForm';
import useAlertList from '../hooks/api/useAlertList';
import FormModal from "../components/common/FormModal";
import {useToast} from "../components/toast/ToastContext";
import Pagination from "../components/common/Pagination";
import {usePaginationState} from "../hooks/usePaginationState";
import {useTranslation} from "react-i18next";

export default function AlertPage() {
    const {t} = useTranslation();
    const [mode, setMode] = useState('rule'); // 'rule' or 'history'
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState(t('button_add'));
    const [modalSubmit, setModalSubmit] = useState(() => () => {});
    const [initialValues, setInitialValues] = useState({});
    const {showSuccessToast, showErrorToast} = useToast();

    const {
        page,
        perPage,
        handlePageChange,
        handlePerPageChange
    } = usePaginationState();

    const [keyword, setKeyword] = useState("");

    const {
        data,
        loading,
        error,
        addRule,
        updateRule,
        deleteRule,
        addHistory,
        searchPage
    } = useAlertList({
        page,
        perPage,
        keyword,
        autoLoad: true,
        mode
    });

    const openAddModal = () => {
        setModalTitle(t('button_add'));
        setModalSubmit(() => addRule);
        setInitialValues({
            ar_type: 1,
            ar_is_active: 1
        });
        setShowModal(true);
    };

    const openEditModal = (rule) => {
        setModalTitle(t('button_edit'));
        setModalSubmit(() => updateRule);
        setInitialValues(rule);
        setShowModal(true);
    };

    const handleDelete = async (ar_id) => {
        try {
            await deleteRule(ar_id);
            showSuccessToast();
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    const handleSearch = useCallback((keyword) => {
        setKeyword(keyword);
        handlePageChange(1);
    }, [handlePageChange]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch(keyword);
        }
    };

    return (
        <div className="space-y-6">
            {/* 模式切换按钮 */}
            <div className="flex items-center gap-4 mb-4">
                <button
                    className={`btn-${mode === 'rule' ? 'primary' : 'secondary'}`}
                    onClick={() => setMode('rule')}
                >
                    {t('alert_rule_management')}
                </button>
                <button
                    className={`btn-${mode === 'history' ? 'primary' : 'secondary'}`}
                    onClick={() => setMode('history')}
                >
                    {t('alert_history_management')}
                </button>
            </div>

            {/* 搜索 + 按钮行 */}
            <div className="search-bar">
                <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('msg_search_placeholder')}
                    className="search-input"
                />
                <button
                    onClick={() => handleSearch(keyword)}
                    className="btn-primary"
                >
                    {t('button_search')}
                </button>

                {/* 右侧按钮组 - 只在规则模式下显示添加按钮 */}
                {mode === 'rule' && (
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={openAddModal} className="btn-primary">
                            {t('button_add')}
                        </button>
                    </div>
                )}
            </div>

            {/* 表格展示 */}
            {mode === 'rule' ? (
                <AlertRuleTable
                    data={data?.items || []}
                    onDelete={handleDelete}
                    onEdit={openEditModal}
                />
            ) : (
                <AlertHistoryTable
                    data={data?.items || []}
                />
            )}

            {/* 分页 */}
            {data?.pagination && (
                <Pagination
                    pagination={{
                        page,
                        per_page: perPage,
                        total: data.pagination.total,
                        pages: data.pagination.pages,
                    }}
                    onPageChange={handlePageChange}
                    onPerPageChange={handlePerPageChange}
                />
            )}

            {/* 模态框 - 只在规则模式下显示 */}
            {mode === 'rule' && (
                <FormModal
                    title={modalTitle}
                    show={showModal}
                    onClose={() => setShowModal(false)}
                    onSubmit={modalSubmit}
                    FormComponent={AlertRuleForm}
                    initialValues={initialValues}
                />
            )}
        </div>
    );
}
