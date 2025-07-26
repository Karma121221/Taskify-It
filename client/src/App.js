import React, { useState, useRef } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState([]);
  const [checkedTasks, setCheckedTasks] = useState({});
  const [taskDates, setTaskDates] = useState({});
  const [error, setError] = useState(null);

  const contentRef = useRef();

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

    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      const uploadRes = await axios.post('http://localhost:5000/upload-pdf', formData);
      const { text } = uploadRes.data;

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

  return (
    <div className="App">
      <h1>📘 AI Study Planner</h1>

      <div className="upload-section">
        <input type="file" accept=".pdf" onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={loading}>
          {loading ? 'Processing...' : 'Upload PDF & Generate Tasks'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {modules.length > 0 && (
        <>
          <div className="export-container">
            <button onClick={exportToPDF} className="export-button">
              📤 Export as PDF
            </button>
          </div>

          <div ref={contentRef} className="module-list">
            <h2>🔖 Topics To Cover: </h2>
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
    </div>
  );
}

export default App;
