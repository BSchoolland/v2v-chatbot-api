const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mime = require('mime-types');
const { authMiddleware } = require('./middleware');
const { 
    getChatbotFromPlanId, 
    addFile, 
    updateFileVisibility, 
    updateFileReferencing, 
    updateFileTextContent, 
    deleteFile, 
    getFilesByWebsiteId,
    uploadsDir
} = require('../backend/database/queries');
const TextExtractor = require('./textExtractor');
const { logger } = require('../utils/fileLogger');
// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate a unique filename while preserving the original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

// File filter to only allow text-based files
const fileFilter = (req, file, cb) => {
    logger.info('Received file:', {
        originalname: file.originalname,
        mimetype: file.mimetype
    });

    // Get proper MIME type based on file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const detectedMimeType = mime.lookup(ext);

    logger.info('Detected MIME type:', detectedMimeType);

    // List of allowed MIME types
    const allowedMimeTypes = [
        // Text files
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/json',
        // PDF files
        'application/pdf',
        // Word documents
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        // Excel files
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (detectedMimeType && allowedMimeTypes.includes(detectedMimeType)) {
        // Override the incoming mimetype with the detected one
        file.mimetype = detectedMimeType;
        cb(null, true);
    } else {
        logger.info('Rejected file type:', detectedMimeType || file.mimetype);
        cb(new Error('Invalid file type. Only text-based files are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Upload a file
router.post('/upload/:planId', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { planId } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Get the chatbot associated with this plan
        const chatbot = await getChatbotFromPlanId(planId);
        if (!chatbot) {
            return res.status(404).json({ success: false, message: 'Chatbot not found' });
        }

        if (!chatbot.website_id) {
            return res.status(400).json({ success: false, message: 'Chatbot must be associated with a website' });
        }

        // Add file to database first
        const fileId = await addFile(
            chatbot.website_id,
            file.originalname,
            file.filename,
            file.mimetype,
            file.size
        );

        // Extract text content asynchronously
        try {
            const filePath = path.join(uploadsDir, file.filename);
            const textContent = await TextExtractor.extractFromFile(filePath, file.mimetype);
            await updateFileTextContent(fileId, textContent);
        } catch (extractError) {
            logger.error('Error extracting text content:', extractError);
            // Don't fail the upload if text extraction fails
        }

        res.status(200).json({
            success: true,
            fileId: fileId,
            message: 'File uploaded successfully'
        });
    } catch (error) {
        logger.error('Error uploading file:', error);
        res.status(500).json({ success: false, message: 'Error uploading file' });
    }
});

// Get all files for a chatbot
router.get('/list/:planId', authMiddleware, async (req, res) => {
    try {
        const { planId } = req.params;

        // Get the chatbot associated with this plan
        const chatbot = await getChatbotFromPlanId(planId);
        if (!chatbot) {
            return res.status(404).json({ success: false, message: 'Chatbot not found' });
        }

        if (!chatbot.website_id) {
            return res.status(400).json({ success: false, message: 'Chatbot must be associated with a website' });
        }

        const files = await getFilesByWebsiteId(chatbot.website_id);
        res.status(200).json({ success: true, files });
    } catch (error) {
        logger.error('Error getting files:', error);
        res.status(500).json({ success: false, message: 'Error getting files' });
    }
});

// Update file visibility
router.put('/visibility/:fileId', authMiddleware, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { isVisible } = req.body;

        if (typeof isVisible !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Invalid visibility value' });
        }

        await updateFileVisibility(fileId, isVisible);
        res.status(200).json({ success: true, message: 'File visibility updated' });
    } catch (error) {
        logger.error('Error updating file visibility:', error);
        res.status(500).json({ success: false, message: 'Error updating file visibility' });
    }
});

// Update file referencing
router.put('/referencing/:fileId', authMiddleware, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { allowReferencing } = req.body;

        if (typeof allowReferencing !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Invalid referencing value' });
        }

        await updateFileReferencing(fileId, allowReferencing);
        res.status(200).json({ success: true, message: 'File referencing updated' });
    } catch (error) {
        logger.error('Error updating file referencing:', error);
        res.status(500).json({ success: false, message: 'Error updating file referencing' });
    }
});

// Delete a file
router.delete('/:fileId', authMiddleware, async (req, res) => {
    try {
        const { fileId } = req.params;
        await deleteFile(fileId);
        res.status(200).json({ success: true, message: 'File deleted' });
    } catch (error) {
        logger.error('Error deleting file:', error);
        res.status(500).json({ success: false, message: 'Error deleting file' });
    }
});

module.exports = router; 