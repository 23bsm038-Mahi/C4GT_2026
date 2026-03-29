import { useState } from 'react';

function LoginPage({ onLogin }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!name.trim() || !mobile.trim()) {
      setError('Please enter your name and mobile number.');
      return;
    }

    setError('');
    onLogin({
      name: name.trim(),
      mobile: mobile.trim(),
    });
  };

  return (
    <div className="login-wrapper">
      <div className="login-card page-card">
        <span className="login-badge">GovTech Learning App</span>
        <h1 className="page-title">Student Login</h1>
        <p className="page-subtitle">
          Sign in to continue your beginner GovTech learning journey.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="student-name">
              Student Name
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

          {error ? <p className="form-error">{error}</p> : null}

          <div className="button-row">
            <button type="submit" className="primary-button">
              Login to Dashboard
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
