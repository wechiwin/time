/**
 * Excel template language detection utility
 * Detects the language of an Excel template based on column headers
 */
import readXlsxFile from 'read-excel-file';

// Language-specific column name mappings
const COLUMN_SIGNATURES = {
    en: {
        trade: ['Code', 'Trade Type', 'Trade Date', 'NAV Per Unit', 'Trade Shares', 'Trade Amount', 'Trade Fee', 'Gross Amount'],
        holding: ['Code', 'Name', 'Type', 'Establish Date', 'Short Name']
    },
    zh: {
        trade: ['持仓代码', '交易类型', '交易日期', '单位净值', '交易份数', '交易金额', '交易费用', '交易本金'],
        holding: ['持仓代码', '持仓名称', '持仓类型', '成立日期', '持仓简称']
    },
    it: {
        trade: ['Codice', 'Tipo di Transazione', 'Data di Transazione', 'Valore netto', 'Azioni della transazione', 'Importo Netto', 'Commissione della transazione', 'Importo Lordo'],
        holding: ['Codice', 'Nome', 'Tipo', 'Data di Costituzione', 'Nome Breve']
    }
};

/**
 * Calculate match score between Excel columns and language signature
 * @param {string[]} excelColumns - Column names from Excel
 * @param {string[]} signature - Expected column names for a language
 * @returns {number} - Match score (0-1)
 */
function calculateMatchScore(excelColumns, signature) {
    const normalizedExcel = excelColumns.map(col => col?.toString().trim().toLowerCase());
    const normalizedSignature = signature.map(col => col?.toLowerCase());

    let matchCount = 0;
    for (const sigCol of normalizedSignature) {
        if (normalizedExcel.some(excelCol => excelCol?.includes(sigCol) || sigCol?.includes(excelCol))) {
            matchCount++;
        }
    }
    return matchCount / signature.length;
}

/**
 * Detect the language of an Excel file based on column headers
 * @param {File} file - The Excel file to detect
 * @param {'trade' | 'holding'} templateType - Type of template
 * @returns {Promise<string>} - Detected language code ('en', 'zh', 'it')
 */
export async function detectExcelLanguage(file, templateType = 'trade') {
    try {
        const rows = await readXlsxFile(file);

        if (rows.length === 0) {
            return 'en'; // Default to English if no data
        }

        const headers = rows[0]; // First row contains headers

        // Calculate match scores for each language
        const scores = {};
        for (const [lang, templates] of Object.entries(COLUMN_SIGNATURES)) {
            scores[lang] = calculateMatchScore(headers, templates[templateType]);
        }

        // Find the language with highest score
        let bestLang = 'en';
        let bestScore = 0;
        for (const [lang, score] of Object.entries(scores)) {
            if (score > bestScore) {
                bestScore = score;
                bestLang = lang;
            }
        }

        return bestLang;
    } catch (error) {
        console.error('Error detecting Excel language:', error);
        return 'en'; // Default to English on error
    }
}
