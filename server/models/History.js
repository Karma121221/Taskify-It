const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  modules: [{
    topic: {
      type: String,
      required: true,
      trim: true
    },
    tasks: [{
      description: {
        type: String,
        required: true,
        trim: true
      },
      resources: [{
        title: {
          type: String,
          required: true,
          trim: true
        },
        url: {
          type: String,
          required: false,
          trim: true,
          default: '#'
        }
      }]
    }]
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'history'
});

// Index for efficient querying
historySchema.index({ userId: 1, createdAt: -1 });

// Virtual to get formatted creation date
historySchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Method to calculate total tasks
historySchema.virtual('totalTasks').get(function() {
  return this.modules.reduce((total, module) => total + module.tasks.length, 0);
});

// Ensure virtuals are included in JSON output
historySchema.set('toJSON', { virtuals: true });
historySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('History', historySchema);