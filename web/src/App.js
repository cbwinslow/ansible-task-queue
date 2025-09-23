import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('bash');
  const [description, setDescription] = useState('');
  const [targetHost, setTargetHost] = useState('localhost');
  const [priority, setPriority] = useState(100);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' });
  const [activeTab, setActiveTab] = useState('login');
  const [lintResults, setLintResults] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token and set user
      fetch('/api/health')
        .then(res => res.json())
        .then(data => {
          if (data.status === 'ok') {
            setUser({ username: 'demo_user' }); // Simplified for demo
            loadTasks();
          }
        })
        .catch(err => {
          localStorage.removeItem('token');
        });
    }
  }, []);

  const loadTasks = () => {
    // Load user tasks
    setTasks([
      { id: 1, description: 'System Update', status: 'completed', createdAt: '2025-01-01T10:00:00Z' },
      { id: 2, description: 'Backup Database', status: 'running', createdAt: '2025-01-01T11:00:00Z' },
      { id: 3, description: 'Restart Service', status: 'pending', createdAt: '2025-01-01T12:00:00Z' }
    ]);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Simulate login
      const token = 'demo-token';
      localStorage.setItem('token', token);
      setUser({ username: loginForm.username });
      loadTasks();
      addNotification('Login successful!', 'success');
    } catch (error) {
      addNotification('Login failed!', 'error');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      // Simulate registration
      const token = 'demo-token';
      localStorage.setItem('token', token);
      setUser({ username: registerForm.username });
      loadTasks();
      addNotification('Registration successful!', 'success');
    } catch (error) {
      addNotification('Registration failed!', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setTasks([]);
    addNotification('Logged out successfully!', 'info');
  };

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    try {
      // Simulate task submission
      const newTask = {
        id: tasks.length + 1,
        description,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      setTasks([newTask, ...tasks]);
      setCode('');
      setDescription('');
      addNotification('Task submitted successfully!', 'success');
    } catch (error) {
      addNotification('Task submission failed!', 'error');
    }
  };

  const handleLintCode = async () => {
    try {
      // Simulate code linting
      const results = {
        errors: code.includes('var ') ? [{ line: 1, column: 1, message: 'Prefer const or let over var' }] : [],
        warnings: [],
        info: []
      };
      setLintResults(results);
      addNotification('Code linted successfully!', 'info');
    } catch (error) {
      addNotification('Linting failed!', 'error');
    }
  };

  const addNotification = (message, type) => {
    const notification = { id: Date.now(), message, type };
    setNotifications([...notifications, notification]);
    setTimeout(() => {
      setNotifications(notifications.filter(n => n.id !== notification.id));
    }, 5000);
  };

  if (!user) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>🚀 Cloudflare Mobile Task Executor</h1>
          <p>Execute tasks securely from your mobile device</p>
        </header>

        <main className="auth-container">
          <div className="auth-tabs">
            <button 
              className={activeTab === 'login' ? 'active' : ''}
              onClick={() => setActiveTab('login')}
            >
              Login
            </button>
            <button 
              className={activeTab === 'register' ? 'active' : ''}
              onClick={() => setActiveTab('register')}
            >
              Register
            </button>
          </div>

          {activeTab === 'login' && (
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  required
                />
              </div>
              <button type="submit" className="btn-primary">Login</button>
              <div className="oauth-buttons">
                <button type="button" className="btn-github">
                  Login with GitHub
                </button>
              </div>
            </form>
          )}

          {activeTab === 'register' && (
            <form className="auth-form" onSubmit={handleRegister}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                  required
                />
              </div>
              <button type="submit" className="btn-primary">Register</button>
            </form>
          )}
        </main>

        <div className="notifications">
          {notifications.map(notification => (
            <div key={notification.id} className={`notification ${notification.type}`}>
              {notification.message}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🚀 Cloudflare Mobile Task Executor</h1>
        <div className="user-menu">
          <span>Welcome, {user.username}!</span>
          <button onClick={handleLogout} className="btn-secondary">Logout</button>
        </div>
      </header>

      <main className="main-content">
        <div className="task-form-container">
          <h2>Submit New Task</h2>
          <form className="task-form" onSubmit={handleSubmitTask}>
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What task would you like to execute?"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Code</label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter your bash script, Ansible playbook, or other code..."
                rows="10"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="bash">Bash Script</option>
                  <option value="ansible">Ansible Playbook</option>
                  <option value="python">Python Script</option>
                  <option value="javascript">JavaScript</option>
                </select>
              </div>

              <div className="form-group">
                <label>Target Host</label>
                <input
                  type="text"
                  value={targetHost}
                  onChange={(e) => setTargetHost(e.target.value)}
                  placeholder="localhost"
                />
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select value={priority} onChange={(e) => setPriority(parseInt(e.target.value))}>
                  <option value="10">High (10)</option>
                  <option value="50">Medium (50)</option>
                  <option value="100">Normal (100)</option>
                  <option value="200">Low (200)</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={handleLintCode} className="btn-secondary">
                🔍 Lint Code
              </button>
              <button type="submit" className="btn-primary">
                🚀 Submit Task
              </button>
            </div>
          </form>

          {lintResults && (
            <div className="lint-results">
              <h3>Lint Results</h3>
              {lintResults.errors.length > 0 && (
                <div className="lint-errors">
                  <h4>Errors:</h4>
                  {lintResults.errors.map((error, index) => (
                    <div key={index} className="lint-item error">
                      Line {error.line}, Column {error.column}: {error.message}
                    </div>
                  ))}
                </div>
              )}
              {lintResults.warnings.length > 0 && (
                <div className="lint-warnings">
                  <h4>Warnings:</h4>
                  {lintResults.warnings.map((warning, index) => (
                    <div key={index} className="lint-item warning">
                      Line {warning.line}, Column {warning.column}: {warning.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="tasks-container">
          <h2>Your Tasks</h2>
          <div className="tasks-list">
            {tasks.map(task => (
              <div key={task.id} className={`task-card ${task.status}`}>
                <div className="task-header">
                  <h3>{task.description}</h3>
                  <span className={`status-badge ${task.status}`}>{task.status}</span>
                </div>
                <div className="task-details">
                  <p>Created: {new Date(task.createdAt).toLocaleString()}</p>
                  <div className="task-actions">
                    <button className="btn-secondary">View Details</button>
                    {task.status === 'pending' && (
                      <button className="btn-danger">Cancel</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className="notifications">
        {notifications.map(notification => (
          <div key={notification.id} className={`notification ${notification.type}`}>
            {notification.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;