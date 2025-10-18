// src/components/common/Pagination.jsx
export default function Pagination({ pagination, onPageChange, onPerPageChange }) {
    const { page, per_page, total, pages } = pagination || {};

    if (!pagination || pages <= 1) return null;

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pages) {
            onPageChange(newPage);
        }
    };

    const handlePerPageChange = (e) => {
        const newPerPage = parseInt(e.target.value);
        onPerPageChange(newPerPage);
    };

    const renderPageNumbers = () => {
        const pageNumbers = [];
        const maxVisiblePages = 5;

        let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(pages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        // 第一页
        if (startPage > 1) {
            pageNumbers.push(
                <button
                    key={1}
                    onClick={() => handlePageChange(1)}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                >
                    1
                </button>
            );
            if (startPage > 2) {
                pageNumbers.push(<span key="start-ellipsis" className="px-2">...</span>);
            }
        }

        // 中间页码
        for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(
                <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    className={`px-3 py-1 border ${
                        i === page
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'border-gray-300 hover:bg-gray-50'
                    } rounded`}
                >
                    {i}
                </button>
            );
        }

        // 最后一页
        if (endPage < pages) {
            if (endPage < pages - 1) {
                pageNumbers.push(<span key="end-ellipsis" className="px-2">...</span>);
            }
            pageNumbers.push(
                <button
                    key={pages}
                    onClick={() => handlePageChange(pages)}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                >
                    {pages}
                </button>
            );
        }

        return pageNumbers;
    };

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 space-y-4 sm:space-y-0">
            {/* 每页数量选择 */}
            <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">每页显示：</span>
                <select
                    value={per_page || 10}
                    onChange={handlePerPageChange}
                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="5">5 条</option>
                    <option value="10">10 条</option>
                    <option value="20">20 条</option>
                    <option value="50">50 条</option>
                    <option value="100">100 条</option>
                </select>
                <span className="text-sm text-gray-700">
                    第 {page} 页，共 {pages} 页，总计 {total} 条记录
                </span>
            </div>

            {/* 页码导航 */}
            <div className="flex items-center space-x-2">
                <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                    上一页
                </button>

                {renderPageNumbers()}

                <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= pages}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                    下一页
                </button>
            </div>
        </div>
    );
}