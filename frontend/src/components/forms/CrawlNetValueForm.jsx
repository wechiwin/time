// src/components/forms/CrawlNetValueForm.jsx
import { useState } from 'react';
import HoldingSearchSelect from '../search/HoldingSearchSelect';

export default function CrawlNetValueForm({ onSubmit, onClose, initialValues }) {
    const [formData, setFormData] = useState({
        ho_code: initialValues.ho_code || '',
        start_date: initialValues.start_date || '',
        end_date: initialValues.end_date || ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.ho_code) {
            alert('请选择基金');
            return;
        }
        onSubmit(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium mb-1">
                    基金代码
                </label>
                <HoldingSearchSelect
                    value={formData.ho_code}
                    onChange={(value) => handleChange('ho_code', value)}
                    placeholder="搜索并选择基金"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    开始日期
                </label>
                <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => handleChange('start_date', e.target.value)}
                    className="w-full input"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    结束日期
                </label>
                <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => handleChange('end_date', e.target.value)}
                    className="w-full input"
                />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="btn-secondary"
                >
                    取消
                </button>
                <button
                    type="submit"
                    className="btn-primary"
                >
                    开始爬取
                </button>
            </div>
        </form>
    );
}