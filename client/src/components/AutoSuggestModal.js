import React, { useState } from 'react';
import '../styles/autosuggest.css';

function AutoSuggestModal({ 
  modules, 
  onApplySuggestions, 
  onClose, 
  isOpen 
}) {
  const [overallDeadline, setOverallDeadline] = useState('');
  const [distribution, setDistribution] = useState('even'); // 'even', 'priority', 'workload'
  const [buffer, setBuffer] = useState(2); // days buffer before deadline

  if (!isOpen) return null;

  const calculateSuggestedDates = () => {
    if (!overallDeadline) return {};

    const deadline = new Date(overallDeadline);
    const today = new Date();
    const totalDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24)) - buffer;
    
    if (totalDays <= 0) return {};

    let suggestedDates = {};
    
    // Count total tasks
    const totalTasks = modules.reduce((sum, module) => sum + module.tasks.length, 0);
    
    if (distribution === 'even') {
      // Distribute evenly across available days
      const daysPerTask = Math.floor(totalDays / totalTasks);
      let taskIndex = 0;
      
      modules.forEach(module => {
        module.tasks.forEach(task => {
          const taskDate = new Date(today);
          taskDate.setDate(today.getDate() + (taskIndex * daysPerTask) + daysPerTask);
          suggestedDates[task.description] = taskDate.toISOString().split('T')[0];
          taskIndex++;
        });
      });
    } else if (distribution === 'priority') {
      // Earlier modules get more time, later ones are compressed
      let dayOffset = 0;
      const baseTime = Math.floor(totalDays / modules.length);
      
      modules.forEach((module, moduleIndex) => {
        const timeForModule = Math.max(
          baseTime - Math.floor(moduleIndex * 0.5), 
          Math.floor(baseTime * 0.3)
        );
        const daysPerTask = Math.floor(timeForModule / module.tasks.length);
        
        module.tasks.forEach((task, taskIndex) => {
          const taskDate = new Date(today);
          taskDate.setDate(today.getDate() + dayOffset + (taskIndex * daysPerTask) + daysPerTask);
          suggestedDates[task.description] = taskDate.toISOString().split('T')[0];
        });
        
        dayOffset += timeForModule;
      });
    } else if (distribution === 'workload') {
      // Distribute based on estimated complexity (task description length as proxy)
      const taskComplexity = [];
      modules.forEach(module => {
        module.tasks.forEach(task => {
          taskComplexity.push({
            description: task.description,
            complexity: Math.max(1, task.description.length / 20) // Simple heuristic
          });
        });
      });
      
      const totalComplexity = taskComplexity.reduce((sum, task) => sum + task.complexity, 0);
      let dayOffset = 0;
      
      taskComplexity.forEach(task => {
        const timeAllocation = Math.floor((task.complexity / totalComplexity) * totalDays);
        const taskDate = new Date(today);
        taskDate.setDate(today.getDate() + dayOffset + timeAllocation);
        suggestedDates[task.description] = taskDate.toISOString().split('T')[0];
        dayOffset += timeAllocation;
      });
    }
    
    return suggestedDates;
  };

  const handleApply = () => {
    const suggestions = calculateSuggestedDates();
    onApplySuggestions(suggestions);
    onClose();
  };

  const previewDates = calculateSuggestedDates();
  const previewCount = Object.keys(previewDates).length;

  return (
    <div className="modal-overlay">
      <div className="auto-suggest-modal">
        <div className="modal-header">
          <h3>📅 Auto-Suggest Task Dates</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-content">
          <div className="input-group">
            <label htmlFor="deadline">Overall Deadline</label>
            <input
              id="deadline"
              type="date"
              value={overallDeadline}
              onChange={(e) => setOverallDeadline(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="input-group">
            <label htmlFor="distribution">Distribution Strategy</label>
            <select
              id="distribution"
              value={distribution}
              onChange={(e) => setDistribution(e.target.value)}
            >
              <option value="even">Even Distribution</option>
              <option value="priority">Priority-Based (More time for early topics)</option>
              <option value="workload">Workload-Based (Complex tasks get more time)</option>
            </select>
          </div>

          <div className="input-group">
            <label htmlFor="buffer">Buffer Days Before Deadline</label>
            <input
              id="buffer"
              type="range"
              min="0"
              max="7"
              value={buffer}
              onChange={(e) => setBuffer(parseInt(e.target.value))}
            />
            <span className="buffer-display">{buffer} days</span>
          </div>

          {overallDeadline && (
            <div className="preview-section">
              <h4>Preview</h4>
              <div className="preview-stats">
                <div className="stat">
                  <span className="stat-number">{previewCount}</span>
                  <span className="stat-label">Tasks to schedule</span>
                </div>
                <div className="stat">
                  <span className="stat-number">
                    {Math.ceil((new Date(overallDeadline) - new Date()) / (1000 * 60 * 60 * 24))}
                  </span>
                  <span className="stat-label">Days available</span>
                </div>
                <div className="stat">
                  <span className="stat-number">{modules.length}</span>
                  <span className="stat-label">Topics</span>
                </div>
              </div>
              
              <div className="distribution-info">
                <p>
                  <strong>{distribution === 'even' && 'Even distribution: '}
                  {distribution === 'priority' && 'Priority-based: '}
                  {distribution === 'workload' && 'Workload-based: '}</strong>
                  {distribution === 'even' && 'Tasks spaced evenly across available time'}
                  {distribution === 'priority' && 'Earlier topics get more time for thorough learning'}
                  {distribution === 'workload' && 'Complex tasks allocated more time automatically'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleApply}
            disabled={!overallDeadline || previewCount === 0}
          >
            Apply Suggestions ({previewCount} tasks)
          </button>
        </div>
      </div>
    </div>
  );
}

export default AutoSuggestModal;