import { useEffect, useState } from 'react';
import './App.css';
import Dashboard from './Dashboard';
import Course from './Course';
import Login from './Login';
import { courseList } from './courseData';

function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [student, setStudent] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedCourse = courseList.find((course) => course.id === selectedCourseId);

  useEffect(() => {
    if (!isLoading) {
      return undefined;
    }

    // A short delay makes the login flow feel a bit closer to a real app.
    const timer = setTimeout(() => {
      setIsLoading(false);
      setCurrentScreen('dashboard');
    }, 600);

    return () => clearTimeout(timer);
  }, [isLoading]);

  const handleLogin = (formValues) => {
    setStudent(formValues);
    setIsLoading(true);
  };

  const handleOpenCourse = (courseId) => {
    setSelectedCourseId(courseId);
    setCurrentScreen('course');
  };

  const handleBackToDashboard = () => {
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    setStudent(null);
    setSelectedCourseId(null);
    setCurrentScreen('login');
  };

  return (
    <div className="app-shell">
      {currentScreen === 'login' && <Login onLogin={handleLogin} />}

      {isLoading && (
        <div className="page-layout">
          <div className="loading-card page-card">
            <p className="loading-title">Loading your learning dashboard...</p>
            <p className="loading-text">
              We are checking your student details and preparing your courses.
            </p>
          </div>
        </div>
      )}

      {currentScreen === 'dashboard' && student && !isLoading && (
        <Dashboard
          student={student}
          courses={courseList}
          onOpenCourse={handleOpenCourse}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === 'course' && student && selectedCourse && (
        <Course
          student={student}
          course={selectedCourse}
          onBack={handleBackToDashboard}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
