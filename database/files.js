const { dbGet, dbRun, dbAll, generateUniqueId } = require('./database.js');
const path = require('path');
const fs = require('fs');

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, '../data/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Add a new file
async function addFile(chatbotId, websiteId, originalFilename, storedFilename, fileType, fileSize, textContent = null, isVisible = true, allowReferencing = true) {
    const fileId = await generateUniqueId('files', 'file_id');
    const uploadDate = new Date().toISOString();
    
    await dbRun(
        `INSERT INTO files (
            file_id, chatbot_id, website_id, original_filename, stored_filename, 
            file_type, file_size, text_content, upload_date, is_visible, allow_referencing
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [fileId, chatbotId, websiteId, originalFilename, storedFilename, fileType, fileSize, textContent, uploadDate, isVisible, allowReferencing]
    );
    
    return fileId;
}

// Get file by ID
async function getFileById(fileId) {
    return dbGet(
        `SELECT * FROM files WHERE file_id = ?`,
        [fileId]
    );
}

// Get all files for a chatbot
async function getFilesByChatbotId(chatbotId) {
    return dbAll(
        `SELECT * FROM files WHERE chatbot_id = ? ORDER BY upload_date DESC`,
        [chatbotId]
    );
}

// Get all files for a website
async function getFilesByWebsiteId(websiteId) {
    return dbAll(
        `SELECT * FROM files WHERE website_id = ? ORDER BY upload_date DESC`,
        [websiteId]
    );
}

// Update file visibility
async function updateFileVisibility(fileId, isVisible) {
    return dbRun(
        `UPDATE files SET is_visible = ? WHERE file_id = ?`,
        [isVisible, fileId]
    );
}

// Update file referencing
async function updateFileReferencing(fileId, allowReferencing) {
    return dbRun(
        `UPDATE files SET allow_referencing = ? WHERE file_id = ?`,
        [allowReferencing, fileId]
    );
}

// Update file text content
async function updateFileTextContent(fileId, textContent) {
    return dbRun(
        `UPDATE files SET text_content = ? WHERE file_id = ?`,
        [textContent, fileId]
    );
}

// Delete a file
async function deleteFile(fileId) {
    // Get the stored filename first
    const file = await getFileById(fileId);
    if (!file) {
        throw new Error('File not found');
    }
    
    // Delete the file from the filesystem
    const filePath = path.join(uploadsDir, file.stored_filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    
    // Delete the record from the database
    return dbRun(
        `DELETE FROM files WHERE file_id = ?`,
        [fileId]
    );
}

module.exports = {
    addFile,
    getFileById,
    getFilesByChatbotId,
    getFilesByWebsiteId,
    updateFileVisibility,
    updateFileReferencing,
    updateFileTextContent,
    deleteFile,
    uploadsDir
}; 