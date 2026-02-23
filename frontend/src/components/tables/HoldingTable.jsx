// src/components/tables/FundTable.jsx
import DeleteButton from '../common/DeleteButton';
import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next'
import {useEnumTranslation} from '../../contexts/EnumContext';
import React from "react";

export default function HoldingTable({data = [], onDelete, onEdit}) {

    const navigate = useNavigate();
    const {t} = useTranslation()
    const {translateEnum} = useEnumTranslation();

    // const handleRowClick = (fund) => {
    //     navigate(`/holding/${fund.ho_code}`);
    // };

    return (
        <div className="table-container">
            <table className="min-w-full">
                <thead>
                <tr>
                    <th className="table-header">{t('th_ho_code')}</th>
                    <th className="table-header">{t('th_ho_name')}</th>
                    <th className="table-header">{t('th_ho_type')}</th>
                    <th className="table-header">{t('th_ho_establish_date')}</th>
                    <th className="table-header">{t('info_hold_status')}</th>
                    {/* <th className="table-header">{t('th_currency')}</th> */}
                    <th scope="col" className="table-header sticky-action-header">
                        {t('th_actions')}
                    </th>
                </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
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
                        <td className="table-cell">{translateEnum('HoldingTypeEnum', f.ho_type)}</td>
                        <td className="table-cell">{f.establishment_date}</td>
                        <td className="table-cell">{translateEnum('HoldingStatusEnum', f.ho_status)}</td>
                        {/* <td className="table-cell">{f.currency}</td> */}
                        <td className="table-cell sticky-action-cell">
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    className="btn-secondary"
                                    onClick={() => onEdit(f)}
                                >
                                    {t('button_edit')}
                                </button>
                                <DeleteButton
                                    onConfirm={() => onDelete(f)}
                                    description={`${f.ho_short_name} ?`}
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
