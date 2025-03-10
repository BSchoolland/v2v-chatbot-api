const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authMiddleware } = require('./middleware');
const { addFile, getFileById, getFilesByChatbotId, updateFileVisibility, updateFileReferencing, deleteFile, uploadsDir } = require('../database/files');
const { getChatbotFromPlanId } = require('../database/chatbots');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate a unique filename while preserving the original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter to only allow text-based files
const fileFilter = (req, file, cb) => {
    // List of allowed MIME types
    const allowedMimeTypes = [
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/json',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
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
        const { websiteId } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Get the chatbot associated with this plan
        const chatbot = await getChatbotFromPlanId(planId);
        if (!chatbot) {
            return res.status(404).json({ success: false, message: 'Chatbot not found' });
        }

        // Add file to database
        const fileId = await addFile(
            chatbot.chatbot_id,
            websiteId || null,
            file.originalname,
            file.filename,
            file.mimetype,
            file.size
        );

        res.status(200).json({
            success: true,
            fileId: fileId,
            message: 'File uploaded successfully'
        });
    } catch (error) {
        console.error('Error uploading file:', error);
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

        const files = await getFilesByChatbotId(chatbot.chatbot_id);
        res.status(200).json({ success: true, files });
    } catch (error) {
        console.error('Error getting files:', error);
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
        console.error('Error updating file visibility:', error);
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
        console.error('Error updating file referencing:', error);
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
        console.error('Error deleting file:', error);
        res.status(500).json({ success: false, message: 'Error deleting file' });
    }
});

module.exports = router; 