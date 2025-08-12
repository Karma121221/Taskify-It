import React from 'react';

function Dashboard({ 
  modules, 
  checkedTasks, 
  calculateProgress, 
  calculateTimeLeft, 
  calculateOverdueTasks,
  rescheduleTask,
  onToggleDashboard 
}) {
  const overdueTasks = calculateOverdueTasks();

  return (
    <div className="dashboard">
      <div className="header-container">
        <h2>📊 Study Progress Dashboard</h2>
        <button className="dashboard-button" onClick={onToggleDashboard}>
          <span>📚</span> View Tasks
        </button>
      </div>
      
      <div className="progress-container">
        <h3>Overall Progress</h3>
        <div className="progress-bar-container">
          <div 
            className="progress-bar" 
            style={{ width: `${calculateProgress()}%` }}
          ></div>
          <span className="progress-text">{calculateProgress()}% Complete</span>
        </div>
      </div>

      {/* Overdue Tasks Section */}
      {overdueTasks.length > 0 && (
        <div className="overdue-container">
          <h3>⚠️ Overdue Tasks</h3>
          <ul className="overdue-list">
            {overdueTasks.map((task, index) => (
              <li key={index} className="overdue-item">
                <div className="overdue-info">
                  <span className="overdue-task">{task.description}</span>
                  <span className="overdue-date">Due: {task.date.toLocaleDateString()}</span>
                  <span className="days-overdue">
                    {task.daysOverdue} {task.daysOverdue === 1 ? 'day' : 'days'} overdue
                  </span>
                </div>
                <div className="reschedule-actions">
                  <button 
                    className="reschedule-btn reschedule-week"
                    onClick={() => rescheduleTask(task.description, 7)}
                    title="Reschedule for next week"
                  >
                    +1 Week
                  </button>
                  <button 
                    className="reschedule-btn reschedule-days"
                    onClick={() => rescheduleTask(task.description, 3)}
                    title="Reschedule for 3 days"
                  >
                    +3 Days
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="deadlines-container">
        <h3>Upcoming Deadlines</h3>
        {calculateTimeLeft().length > 0 ? (
          <ul className="deadlines-list">
            {calculateTimeLeft().map((task, index) => (
              <li key={index} className="deadline-item">
                <div className="deadline-info">
                  <span className="deadline-task">{task.description}</span>
                  <span className="deadline-date">{task.date.toLocaleDateString()}</span>
                </div>
                <div className="days-left">
                  <span className={task.daysLeft < 3 ? 'urgent' : ''}>
                    {task.daysLeft} {task.daysLeft === 1 ? 'day' : 'days'} left
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No upcoming deadlines or all tasks completed!</p>
        )}
      </div>
      
      <div className="topic-progress">
        <h3>Progress by Topic</h3>
        {modules.map((module, index) => {
          const totalTopicTasks = module.tasks.length;
          const completedTopicTasks = module.tasks.filter(task => 
            checkedTasks[task.description]
          ).length;
          const topicProgress = totalTopicTasks > 0 
            ? Math.round((completedTopicTasks / totalTopicTasks) * 100) 
            : 0;
          
          return (
            <div key={index} className="topic-progress-item">
              <div className="topic-header">
                <span className="topic-name">{module.topic}</span>
                <span className="topic-percentage">{topicProgress}%</span>
              </div>
              <div className="topic-progress-bar-container">
                <div 
                  className="topic-progress-bar" 
                  style={{ width: `${topicProgress}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Dashboard;