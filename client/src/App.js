import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import './Dashboard.css';
import './styles/darkmode.css';
import Navbar from './components/navbar';
import Dashboard from './components/dashboard';
import History from './components/History';
import AutoSuggestModal from './components/AutoSuggestModal';
import AuthModal from './components/auth/AuthModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import config from './config';
import { Analytics } from '@vercel/analytics/react';

// Configure axios defaults
axios.defaults.baseURL = config.API_BASE_URL;
axios.defaults.timeout = 30000; // 30 seconds

function AppContent() {
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState([]);
  const [checkedTasks, setCheckedTasks] = useState({});
  const [taskDates, setTaskDates] = useState({});
  const [error, setError] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [syllabusText, setSyllabusText] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [showAutoSuggest, setShowAutoSuggest] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const { loading: authLoading, isAuthenticated } = useAuth();
  const contentRef = useRef();

  // Load saved data from localStorage on initial render
  useEffect(() => {
    const savedModules = localStorage.getItem('modules');
    const savedCheckedTasks = localStorage.getItem('checkedTasks');
    const savedTaskDates = localStorage.getItem('taskDates');
    const savedSyllabusText = localStorage.getItem('syllabusText');
    const savedDarkMode = localStorage.getItem('darkMode');
    
    if (savedModules) setModules(JSON.parse(savedModules));
    if (savedCheckedTasks) setCheckedTasks(JSON.parse(savedCheckedTasks));
    if (savedTaskDates) setTaskDates(JSON.parse(savedTaskDates));
    if (savedSyllabusText) setSyllabusText(savedSyllabusText);
    if (savedDarkMode) setDarkMode(JSON.parse(savedDarkMode));
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

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    // Apply dark mode to document body
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Check for password reset token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('token')) {
      setAuthMode('reset');
      setShowAuthModal(true);
    }
  }, []);

  // Save to history when modules are successfully generated
  const saveToHistory = async (modules, title = null) => {
    if (!isAuthenticated || modules.length === 0) return;

    try {
      const historyData = {
        title: title || `Study Session ${new Date().toLocaleDateString()}`,
        modules: modules.map(module => ({
          topic: module.topic,
          tasks: module.tasks.map(task => ({
            description: task.description,
            resources: task.resources || []
          }))
        }))
      };

      await axios.post('/history', historyData);
      console.log('History saved successfully');
    } catch (error) {
      console.error('Failed to save history:', error);
      // Don't show error to user as this is non-critical
    }
  };

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
      const uploadRes = await axios.post('/upload-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const { text } = uploadRes.data.data;
      
      // Save syllabus text
      setSyllabusText(text);
  
      const genRes = await axios.post('/generate-tasks', {
        syllabusText: text,
      });
  
      const generatedModules = genRes.data.topics;
      setModules(generatedModules);
      
      // Save to history if user is authenticated
      if (isAuthenticated) {
        const title = pdfFile.name.replace('.pdf', '');
        await saveToHistory(generatedModules, title);
      }
    } catch (err) {
      console.error(err);
      setError('❌ Failed to upload or generate tasks. Please try again.');
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
      const { data } = await axios.post('/export-pdf', {
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
      alert('❌ Failed to export PDF. Please try again.');
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

  // Navigate to history
  const navigateToHistory = () => {
    setShowHistory(true);
    setShowDashboard(false);
  };

  // Navigate back to main
  const navigateBackToMain = () => {
    setShowHistory(false);
    setShowDashboard(false);
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleAutoSuggest = (suggestedDates) => {
    setTaskDates(prev => ({
      ...prev,
      ...suggestedDates
    }));
  };

  const handleOpenAuth = (mode = 'login') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const handleCloseAuth = () => {
    setShowAuthModal(false);
    // Clear any URL params
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  // Show loading spinner during auth check
  if (authLoading) {
    return (
      <div className={`App ${darkMode ? 'dark-mode' : ''}`} style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div className="loading">Checking authentication...</div>
      </div>
    );
  }

  return (
    <div className={`App ${darkMode ? 'dark-mode' : ''}`}>
      <Navbar 
        modules={modules}
        showDashboard={showDashboard}
        onExportPdf={exportToPDF}
        onToggleDashboard={toggleDashboard}
        onOpenAuth={handleOpenAuth}
        onNavigateToHistory={navigateToHistory}
      />

      <div className="content">
        {showHistory ? (
          <History onBackToMain={navigateBackToMain} />
        ) : (
          <>
            {/* Upload Section */}
            <div className="upload-section">
              <input type="file" accept=".pdf" onChange={handleFileChange} />
              <button onClick={handleUpload} disabled={loading}>
                {loading ? 'Processing...' : 'Upload PDF & Generate Tasks'}
              </button>
              {modules.length > 0 && (
                <button 
                  onClick={() => setShowAutoSuggest(true)} 
                  className="auto-suggest-btn"
                >
                  📅 Auto-Suggest Dates
                </button>
              )}
            </div>

            {error && <p className="error">{error}</p>}

            {!showDashboard ? (
              <>
                {modules.length > 0 && (
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
                )}
              </>
            ) : (
              <Dashboard 
                modules={modules}
                checkedTasks={checkedTasks}
                calculateProgress={calculateProgress}
                calculateTimeLeft={calculateTimeLeft}
                onToggleDashboard={toggleDashboard}
              />
            )}
          </>
        )}
      </div>

      <button 
        className="dark-mode-toggle" 
        onClick={toggleDarkMode}
        aria-label="Toggle dark mode"
      >
        {darkMode ? '☀️' : '🌙'}
      </button>

      <AutoSuggestModal
        modules={modules}
        isOpen={showAutoSuggest}
        onClose={() => setShowAutoSuggest(false)}
        onApplySuggestions={handleAutoSuggest}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={handleCloseAuth}
        initialMode={authMode}
      />

      <Analytics />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
