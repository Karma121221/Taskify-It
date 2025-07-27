import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import './Dashboard.css'; // Import the new Dashboard CSS file

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState([]);
  const [checkedTasks, setCheckedTasks] = useState({});
  const [taskDates, setTaskDates] = useState({});
  const [error, setError] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [syllabusText, setSyllabusText] = useState('');

  const contentRef = useRef();

  // Load saved data from localStorage on initial render
  useEffect(() => {
    const savedModules = localStorage.getItem('modules');
    const savedCheckedTasks = localStorage.getItem('checkedTasks');
    const savedTaskDates = localStorage.getItem('taskDates');
    const savedSyllabusText = localStorage.getItem('syllabusText');
    
    if (savedModules) setModules(JSON.parse(savedModules));
    if (savedCheckedTasks) setCheckedTasks(JSON.parse(savedCheckedTasks));
    if (savedTaskDates) setTaskDates(JSON.parse(savedTaskDates));
    if (savedSyllabusText) setSyllabusText(savedSyllabusText);
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (modules.length > 0) {
      localStorage.setItem('modules', JSON.stringify(modules));
    }
  }, [modules]);

  useEffect(() => {
    localStorage.setItem('checkedTasks', JSON.stringify(checkedTasks));
  }, [checkedTasks]);

  useEffect(() => {
    localStorage.setItem('taskDates', JSON.stringify(taskDates));
  }, [taskDates]);

  useEffect(() => {
    if (syllabusText) {
      localStorage.setItem('syllabusText', syllabusText);
    }
  }, [syllabusText]);

  const handleFileChange = (e) => {
    setPdfFile(e.target.files[0]);
    setModules([]);
    setError(null);
  };

  const handleUpload = async () => {
    if (!pdfFile) return;
  
    setLoading(true);
    setError(null);
    setModules([]);
    setCheckedTasks({}); // Reset checked tasks
    setTaskDates({}); // Reset task dates
  
    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      const uploadRes = await axios.post('http://localhost:5000/upload-pdf', formData);
      const { text } = uploadRes.data;
      
      // Save syllabus text
      setSyllabusText(text);
  
      const genRes = await axios.post('http://localhost:5000/generate-tasks', {
        syllabusText: text,
      });
  
      setModules(genRes.data.topics);
    } catch (err) {
      console.error(err);
      setError('❌ Failed to upload or generate tasks.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCheck = (taskDescription) => {
    setCheckedTasks((prev) => ({
      ...prev,
      [taskDescription]: !prev[taskDescription],
    }));
  };

  const handleDateChange = (taskDescription, date) => {
    setTaskDates((prev) => ({
      ...prev,
      [taskDescription]: date,
    }));
  };

  const exportToPDF = async () => {
    try {
      const html = contentRef.current.innerHTML;
      const { data } = await axios.post('http://localhost:5000/export-pdf', {
        htmlContent: `<html><head><style>
          body { font-family: Inter, sans-serif; padding: 20px; }
          h1, h2, h3 { color: #2d3748; }
          ul { padding-left: 20px; }
          li { margin-bottom: 10px; }
          input { display: none; }
          a { color: #3182ce; text-decoration: none; }
        </style></head><body>${html}</body></html>`
      }, {
        responseType: 'blob',
      });

      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'study-plan.pdf';
      link.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('❌ Failed to export PDF');
    }
  };

  // Calculate progress percentage
  const calculateProgress = () => {
    let totalTasks = 0;
    let completedTasks = 0;
    
    modules.forEach(module => {
      module.tasks.forEach(task => {
        totalTasks++;
        if (checkedTasks[task.description]) {
          completedTasks++;
        }
      });
    });
    
    return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  };

  // Calculate estimated time left based on deadlines
  const calculateTimeLeft = () => {
    const today = new Date();
    let upcomingDeadlines = [];
    
    // Get all tasks with deadlines
    Object.entries(taskDates).forEach(([taskDesc, dateStr]) => {
      if (dateStr && !checkedTasks[taskDesc]) {
        const deadlineDate = new Date(dateStr);
        if (deadlineDate > today) {
          upcomingDeadlines.push({
            description: taskDesc,
            date: deadlineDate,
            daysLeft: Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24))
          });
        }
      }
    });
    
    // Sort by closest deadline
    upcomingDeadlines.sort((a, b) => a.date - b.date);
    
    return upcomingDeadlines;
  };

  // Toggle dashboard view
  const toggleDashboard = () => {
    setShowDashboard(!showDashboard);
  };

  return (
    <div className="App">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="nav-left">
          <h1>Taskitize It!</h1>
          <div className="nav-tagline">Upload your syllabus to generate personalized study tasks</div>
        </div>
        <div className="nav-right">
          {modules.length > 0 && (
            <>
              <button onClick={exportToPDF} className="nav-button">
                <span>📄</span> Export PDF
              </button>
              <button 
                onClick={toggleDashboard} 
                className="nav-button"
              >
                {showDashboard ? <><span>📚</span> View Tasks</> : <><span>📊</span> Dashboard</>}
              </button>
            </>
          )}
        </div>
      </nav>
      
      <div className="content">
        {/* Upload Section */}
        <div className="upload-section">
          <input type="file" accept=".pdf" onChange={handleFileChange} />
          <button onClick={handleUpload} disabled={loading}>
            {loading ? 'Processing...' : 'Upload PDF & Generate Tasks'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {!showDashboard ? (
          // Main content
          <>
            {modules.length > 0 && (
              <>
                <div ref={contentRef} className="module-list">
                  <h2>🔖 Topics To Cover</h2>
                  {modules.map((module, index) => (
                    <div key={index} className="module">
                      <h3>{index + 1}. {module.topic}</h3>
                      <ul>
                        {module.tasks.map((task, i) => (
                          <li key={i} className="task-item">
                            <div className="task-content">
                              <div className="task-header">
                                <input
                                  type="checkbox"
                                  checked={!!checkedTasks[task.description]}
                                  onChange={() => toggleCheck(task.description)}
                                />
                                <label>{task.description}</label>
                              </div>
                              {task.resources && (
                                <ul className="resources">
                                  {task.resources.map((res, j) => (
                                    <li key={j}>
                                      🔗 <a href={res.url} target="_blank" rel="noreferrer">{res.title}</a>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="date-section">
                              <input
                                type="date"
                                className="date-picker"
                                value={taskDates[task.description] || ''}
                                onChange={(e) => handleDateChange(task.description, e.target.value)}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          // Dashboard view
          <div className="dashboard">
            <div className="header-container">
              <h2>📊 Study Progress Dashboard</h2>
              <button className="dashboard-button" onClick={toggleDashboard}>
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
        )}
      </div>
    </div>
  );
}

export default App;
