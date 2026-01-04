// src/pages/HoldingPage.jsx
import HoldingForm from '../components/forms/HoldingForm';
import HoldingTable from '../components/tables/HoldingTable';
import useHoldingList from '../hooks/api/useHoldingList';
import {useCallback, useState} from 'react';
import FormModal from "../components/common/FormModal";
import {useToast} from "../components/context/ToastContext";
import Pagination from "../components/common/Pagination";
import {usePaginationState} from "../hooks/usePaginationState";
import {useTranslation} from "react-i18next";

export default function HoldingPage() {
    // 分页
    const {
        page,
        perPage,
        handlePageChange,
        handlePerPageChange
    } = usePaginationState();

    const [keyword, setKeyword] = useState("");
    const {t} = useTranslation()

    // 使用参数驱动的数据获取
    const {
        data,
        loading,
        error,
        add,
        remove,
        search,
        update,
        importData,
        downloadTemplate,
        crawlFundInfo
    } = useHoldingList({
        page,
        perPage,
        keyword,
        autoLoad: true,
    });

    // 模态框控制
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState(t('button_add'));
    const [modalSubmit, setModalSubmit] = useState(() => add);
    const [initialValues, setInitialValues] = useState({});
    const {showSuccessToast, showErrorToast} = useToast();

    const openAddModal = () => {
        setModalTitle(t('button_add'));
        setModalSubmit(() => add);
        setInitialValues({});
        setShowModal(true);
    };

    const openEditModal = (fund) => {
        setModalTitle(t('button_edit'));
        setModalSubmit(() => update);
        setInitialValues(fund);
        setShowModal(true);
    };

    const handleDelete = async (ho_id) => {
        try {
            await remove(ho_id);
            showSuccessToast();
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    // 导入数据
    const handleImport = async () => {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx, .xls';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                await importData(file);
                showSuccessToast();
            };
            input.click();
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    // 搜索处理
    const handleSearch = useCallback((keyword) => {
        setKeyword(keyword);
        handlePageChange(1);
    }, [handlePageChange]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch(keyword);
        }
    };

    /* 供表单使用的爬取回调 */
    const handleCrawl = useCallback(
        async (code, setFormPatch) => {
            try {
                const info = await crawlFundInfo(code);
                // 更新表单，包含所有可能爬取到的字段
                setFormPatch({
                    ho_name: info.ho_name || '',
                    ho_short_name: info.ho_short_name || '',
                    ho_type: info.ho_type || '',
                    establishment_date: info.establishment_date || '',
                    exchange: info.exchange || '',
                    currency: info.currency || '',
                    fund_type: info.fund_type || '',
                    risk_level: info.risk_level || '',
                    trade_type: info.trade_type || '',
                    manage_exp_rate: info.manage_exp_rate || '',
                    trustee_exp_rate: info.trustee_exp_rate || '',
                    sales_exp_rate: info.sales_exp_rate || '',
                    company_id: info.company_id || '',
                    company_name: info.company_name || '',
                    fund_manager: info.fund_manager || '',
                    dividend_method: info.dividend_method || '',
                    index_code: info.index_code || '',
                    index_name: info.index_name || '',
                    feature: info.feature || '',
                });
                showSuccessToast('基金信息爬取成功');
            } catch (e) {
                showErrorToast(e.message);
            }
        },
        [crawlFundInfo, showSuccessToast, showErrorToast]
    );

    return (
        <div className="space-y-6">
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

                {/* 右侧按钮组 */}
                <div className="ml-auto flex items-center gap-2">
                    <button onClick={openAddModal} className="btn-primary">
                        {t('button_add')}
                    </button>
                    <button onClick={downloadTemplate} className="btn-secondary">
                        {t('button_download_template')}
                    </button>
                    <button onClick={handleImport} className="btn-secondary">
                        {t('button_import_data')}
                    </button>
                </div>
            </div>
            <HoldingTable data={data?.items || []} onDelete={handleDelete} onEdit={openEditModal}/>
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
            {/* 模态框 */}
            <FormModal
                title={modalTitle}
                show={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={modalSubmit}
                FormComponent={HoldingForm}
                initialValues={initialValues}
                modalProps={{onCrawl: handleCrawl}}
            />
        </div>
    );
}