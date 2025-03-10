const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const csv = require('csv-parse/sync');

class TextExtractor {
    static async extractFromFile(filePath, mimeType) {
        try {
            switch (mimeType) {
                case 'text/plain':
                case 'text/markdown':
                case 'text/csv':
                case 'application/json':
                    return await fs.readFile(filePath, 'utf-8');

                case 'application/pdf':
                    return await this.extractFromPDF(filePath);

                case 'application/msword':
                case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                    return await this.extractFromDOC(filePath);

                case 'application/vnd.ms-excel':
                case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                    return await this.extractFromExcel(filePath);

                default:
                    throw new Error(`Unsupported file type: ${mimeType}`);
            }
        } catch (error) {
            console.error('Error extracting text:', error);
            throw error;
        }
    }

    static async extractFromPDF(filePath) {
        try {
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdf(dataBuffer);
            return data.text;
        } catch (error) {
            console.error('Error extracting text from PDF:', error);
            throw new Error('Failed to extract text from PDF');
        }
    }

    static async extractFromDOC(filePath) {
        try {
            const extension = path.extname(filePath).toLowerCase();
            if (extension === '.docx') {
                const result = await mammoth.extractRawText({ path: filePath });
                return result.value;
            } else {
                // For .doc files, we'll need to inform the user that only .docx is supported
                throw new Error('Legacy .doc files are not supported. Please convert to .docx format.');
            }
        } catch (error) {
            console.error('Error extracting text from DOC:', error);
            throw new Error('Failed to extract text from DOC');
        }
    }

    static async extractFromExcel(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            let text = '';
            
            // Process each sheet
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const csvData = XLSX.utils.sheet_to_csv(sheet);
                
                // Parse CSV to handle escaping and quoting properly
                const records = csv.parse(csvData, {
                    skip_empty_lines: true
                });
                
                // Add sheet name as header
                text += `\n[Sheet: ${sheetName}]\n`;
                
                // Convert records to readable text
                for (const row of records) {
                    text += row.filter(cell => cell).join(' ') + '\n';
                }
            }
            
            return text.trim();
        } catch (error) {
            console.error('Error extracting text from Excel:', error);
            throw new Error('Failed to extract text from Excel');
        }
    }
}

module.exports = TextExtractor; 