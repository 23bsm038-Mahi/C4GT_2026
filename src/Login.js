import { useState } from 'react';

function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');

  const handleStart = (event) => {
    event.preventDefault();

    // Keep the form simple and pass the values to the parent screen.
    onLogin({
      name: name.trim(),
      mobile: mobile.trim(),
    });
  };

  return (
    <div className="login-wrapper">
      <div className="login-panel page-card">
        <div className="login-info">
          <span className="login-badge">GovTech Learning App</span>
          <h1 className="page-title">Student Login</h1>
          <p className="page-subtitle">Enter your details to continue learning.</p>
        </div>

        <div className="login-card">
          <form onSubmit={handleStart}>
            <div className="form-group">
              <label className="form-label" htmlFor="student-name">
                Name
              </label>
              <input
                id="student-name"
                className="form-input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="student-mobile">
                Mobile Number
              </label>
              <input
                id="student-mobile"
                className="form-input"
                type="tel"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                placeholder="Enter your mobile number"
              />
            </div>

            <div className="button-row">
              <button type="submit" className="primary-button">
                Start Learning
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
