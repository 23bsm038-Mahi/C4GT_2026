function Course({ student, course, onBack, onLogout }) {
  const completedLessons = Math.round((course.progress / 100) * course.lessons.length);

  return (
    <div className="page-layout">
      <div className="page-header page-card page-hero">
        <div>
          <h2>{course.title}</h2>
          <p>
            Student: {student.name} | Course owner: {course.department}
          </p>
        </div>

        <div className="header-actions">
          <button type="button" className="secondary-button" onClick={onBack}>
            Back to Dashboard
          </button>
          <button type="button" className="secondary-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-section page-card">
          <h3>Course Lessons</h3>
          <ul className="lesson-list">
            {course.lessons.map((lesson, index) => (
              <li key={lesson.id} className="lesson-item">
                <p className="lesson-title">
                  Lesson {index + 1}: {lesson.title}
                </p>
                <p className="lesson-time">{lesson.duration}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="detail-section page-card">
          <h3>Progress</h3>

          <div className="progress-box">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${course.progress}%` }}
              />
            </div>
            <p className="progress-text">{course.progress}% of the course completed</p>
          </div>

          <div className="course-note-box">
            <p className="summary-label">Learning Status</p>
            <p className="course-note">
              {completedLessons} of {course.lessons.length} lessons covered
            </p>
            <p className="course-note">Recommended next step: finish the next lesson today.</p>
          </div>

          <h3>Quick Notes</h3>
          <ul className="info-list">
            <li>This course is suitable for beginners.</li>
            <li>The content is designed for civic and public service learning.</li>
            <li>Use the dashboard to switch between different courses.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Course;
