const express = require('express');
const History = require('../models/History');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Validation rules for saving history
const saveHistoryValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title must be less than 200 characters'),
  body('modules')
    .isArray({ min: 1 })
    .withMessage('At least one module is required'),
  body('modules.*.topic')
    .trim()
    .notEmpty()
    .withMessage('Module topic is required'),
  body('modules.*.tasks')
    .isArray({ min: 1 })
    .withMessage('Each module must have at least one task'),
  body('modules.*.tasks.*.description')
    .trim()
    .notEmpty()
    .withMessage('Task description is required')
];

// Get user's history
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await History.countDocuments({ userId: req.user._id });

    // Get history with pagination
    const history = await History.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Add computed fields
    const historyWithStats = history.map(session => ({
      ...session,
      totalTasks: session.modules.reduce((total, module) => total + module.tasks.length, 0),
      topicCount: session.modules.length
    }));

    res.json({
      status: 'success',
      data: {
        history: historyWithStats,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve history. Please try again.'
    });
  }
});

// Save new history session
router.post('/', authenticate, saveHistoryValidation, async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, modules } = req.body;

    // Check if user has reached the limit (optional - prevent spam)
    const userHistoryCount = await History.countDocuments({ userId: req.user._id });
    const maxHistoryItems = 100; // Limit per user

    if (userHistoryCount >= maxHistoryItems) {
      // Delete oldest entries to make room
      const oldestEntries = await History.find({ userId: req.user._id })
        .sort({ createdAt: 1 })
        .limit(userHistoryCount - maxHistoryItems + 1)
        .select('_id');
      
      await History.deleteMany({
        _id: { $in: oldestEntries.map(entry => entry._id) }
      });
    }

    // Create new history entry
    const historyEntry = new History({
      userId: req.user._id,
      title,
      modules
    });

    await historyEntry.save();

    res.status(201).json({
      status: 'success',
      message: 'History saved successfully',
      data: {
        history: historyEntry
      }
    });

  } catch (error) {
    console.error('Save history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save history. Please try again.'
    });
  }
});

// Get specific history session
router.get('/:id', authenticate, async (req, res) => {
  try {
    const history = await History.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!history) {
      return res.status(404).json({
        status: 'error',
        message: 'History session not found'
      });
    }

    res.json({
      status: 'success',
      data: {
        history
      }
    });

  } catch (error) {
    console.error('Get history session error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve history session. Please try again.'
    });
  }
});

// Delete specific history session
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const history = await History.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!history) {
      return res.status(404).json({
        status: 'error',
        message: 'History session not found'
      });
    }

    res.json({
      status: 'success',
      message: 'History session deleted successfully'
    });

  } catch (error) {
    console.error('Delete history session error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete history session. Please try again.'
    });
  }
});

// Clear all history for user
router.delete('/', authenticate, async (req, res) => {
  try {
    const result = await History.deleteMany({ userId: req.user._id });

    res.json({
      status: 'success',
      message: `${result.deletedCount} history sessions deleted successfully`
    });

  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear history. Please try again.'
    });
  }
});

module.exports = router;