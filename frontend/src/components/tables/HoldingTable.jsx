// src/components/tables/FundTable.jsx
import DeleteButton from '../common/DeleteButton';
import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next'

export default function HoldingTable({data = [], onDelete, onEdit}) {

    const navigate = useNavigate();
    const {t} = useTranslation()

    // const handleRowClick = (fund) => {
    //     navigate(`/holding/${fund.ho_code}`);
    // };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="page-bg">
                <tr>
                    <th className="table-header">{t('th_ho_code')}</th>
                    <th className="table-header">{t('th_ho_name')}</th>
                    {/* <th className="table-header">{t('th_ho_short_name')}</th> */}
                    <th className="table-header">{t('th_ho_type')}</th>
                    <th className="table-header">{t('th_ho_establish_date')}</th>
                    <th className="table-header">{t('info_hold_status')}</th>
                    {/* <th className="table-header">{t('th_currency')}</th> */}
                </tr>
                </thead>
                <tbody className="card divide-y divide-gray-200">
                {data.map((f) => (
                    <tr key={f.id} className="hover:page-bg">
                        <td className="table-cell">
                            {/* <button */}
                            {/*     className="text-blue-600 hover:text-blue-800 underline cursor-pointer" */}
                            {/*     onClick={() => handleRowClick(f)} */}
                            {/* > */}
                            {f.ho_code}
                            {/* </button> */}
                        </td>
                        {/* <td className="table-cell font-medium">{f.ho_name}</td> */}
                        <td className="table-cell font-medium">{f.ho_short_name}</td>
                        {/* <td className="table-cell font-medium">{f.ho_nickname}</td> */}
                        <td className="table-cell">{f.ho_type$view}</td>
                        <td className="table-cell">{f.establishment_date}</td>
                        <td className="table-cell">{f.ho_status$view}</td>
                        {/* <td className="table-cell">{f.currency}</td> */}
                        <td className="table-cell">
                            <div className="flex items-center space-x-2">
                                <button
                                    className="btn-secondary"
                                    onClick={() => onEdit(f)}
                                >
                                    {t('button_edit')}
                                </button>
                                <DeleteButton
                                    onConfirm={() => onDelete(f.ho_id)}
                                    description={`${t('msg_delete_confirmation')} ${f.ho_code} - ${f.ho_short_name} ?`}
                                />
                            </div>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}