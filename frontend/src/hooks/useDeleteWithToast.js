// // src/hooks/useDeleteWithToast.js
// import {useCallback} from 'react';
// import {useToast} from '../components/toast/ToastContext'; // 路径根据你的项目调整
//
// /**
//  * 创建一个带 toast 提示的删除函数
//  * @param {Function} deleteFn - 原始删除函数，接受一个 ID 或参数
//  * @param {string} itemName - 要删除的项目名称，用于提示语（如 "基金"、"交易"）
//  * @param {Object} options - 可选配置
//  * @param {string} options.successMessage - 自定义成功提示
//  * @param {string} options.errorMessage - 自定义失败提示前缀
//  * @returns {Function} 包装后的删除函数
//  */
// export default function useDeleteWithToast(deleteFn, itemName = '', options = {}) {
//     const {showSuccessToast, showErrorToast} = useToast();
//
//     const {
//         successMessage = `${itemName}删除成功`,
//         errorMessage = `${itemName}删除失败`,
//     } = options;
//
//     const deleteWithToast = useCallback(
//         async (param) => {
//             try {
//                 await deleteFn(param);
//                 showSuccessToast(successMessage);
//             } catch (error) {
//                 const errorMsg = error.message ? `${errorMessage}: ${error.message}` : errorMessage;
//                 showErrorToast(errorMsg);
//             }
//         },
//         [deleteFn, showSuccessToast, showErrorToast, successMessage, errorMessage]
//     );
//
//     return deleteWithToast;
// }