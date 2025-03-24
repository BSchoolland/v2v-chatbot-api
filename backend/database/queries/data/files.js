const { dbGet, dbRun, dbAll, generateUniqueId } = require('../../config/database.js');
const path = require('path');
const fs = require('fs');

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, '../storage/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Add a new file
async function addFile(websiteId, originalFilename, storedFilename, fileType, fileSize, textContent = null, isVisible = true, allowReferencing = true) {
    const fileId = await generateUniqueId('files', 'file_id');
    const uploadDate = new Date().toISOString();
    
    await dbRun(
        `INSERT INTO files (
            file_id, website_id, original_filename, stored_filename, 
            file_type, file_size, text_content, upload_date, is_visible, allow_referencing
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [fileId, websiteId, originalFilename, storedFilename, fileType, fileSize, textContent, uploadDate, isVisible, allowReferencing]
    );
    
    return fileId;
}

// Get file by ID
async function getFileById(fileId) {
    try {
        const file = await dbGet('SELECT * FROM files WHERE file_id = ?', [fileId]);
        return file;
    } catch (error) {
        console.error(`[getFileById] Database error:`, error);
        throw error;
    }
}

// Get file by filename and website ID
async function getFileByFilename(websiteId, filename) {
    return dbGet(
        `SELECT * FROM files WHERE website_id = ? AND original_filename = ?`,
        [websiteId, filename]
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

// Search through file content
async function searchFileContent(websiteId, searchTerm) {
    const files = await dbAll(
        `SELECT * FROM files 
         WHERE website_id = ? 
         AND is_visible = 1 
         AND allow_referencing = 1 
         AND text_content IS NOT NULL`,
        [websiteId]
    );

    if (!files || files.length === 0) {
        return "No searchable files found";
    }

    const searchWords = searchTerm.toLowerCase().split(/\s+/);
    const rankedResults = files.map(file => {
        const content = file.text_content.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
        const contentWords = content.split(/\s+/);
        let score = 0;
        let consecutiveMatchScore = 0;

        // Calculate word match score
        searchWords.forEach(word => {
            const wordRegex = new RegExp(`\\b${word}\\b`, 'g');
            const matches = content.match(wordRegex);
            if (matches) {
                score += matches.length * 10;
            }
        });

        // Calculate consecutive match score
        for (let i = 0; i < contentWords.length - searchWords.length + 1; i++) {
            let matchCount = 0;
            for (let j = 0; j < searchWords.length; j++) {
                if (contentWords[i + j] === searchWords[j]) {
                    matchCount++;
                } else {
                    break;
                }
            }
            if (matchCount > 1) {
                consecutiveMatchScore += matchCount * 20;
            }
        }

        const totalScore = score + consecutiveMatchScore;

        return {
            fileId: file.file_id,
            filename: file.original_filename,
            score: totalScore,
            excerpt: generateSmartExcerpt(file.text_content, searchWords)
        };
    });

    // Filter out results with no matches
    const matchingResults = rankedResults.filter(result => result.score > 0);

    // Sort by score in descending order
    matchingResults.sort((a, b) => b.score - a.score);

    // Return empty string if no matches found
    if (matchingResults.length === 0) {
        return "No matches found in any files";
    }

    // Turn into a string of the top 10 results and their excerpts
    return matchingResults.slice(0, 10)
        .map(res => `[${res.filename}]: ${res.excerpt}`)
        .join("\n\n");
}

// Helper function to generate an excerpt around the first match
function generateSmartExcerpt(content, searchWords) {
    const normalizedContent = content.toLowerCase();
    const firstMatchIndex = searchWords
        .map(word => normalizedContent.indexOf(word))
        .filter(index => index !== -1)
        .sort((a, b) => a - b)[0];

    if (firstMatchIndex !== undefined) {
        const start = Math.max(0, firstMatchIndex - 50);
        const end = Math.min(content.length, firstMatchIndex + 150);
        const snippet = content.substring(start, end);
        return snippet.replace(/\s+/g, ' ').trim() + '...';
    }

    return content.substring(0, 100) + '...'; // Fallback if no match is found
}

module.exports = {
    addFile,
    getFileById,
    getFileByFilename,
    getFilesByWebsiteId,
    updateFileVisibility,
    updateFileReferencing,
    updateFileTextContent,
    deleteFile,
    searchFileContent,
    uploadsDir
}; 