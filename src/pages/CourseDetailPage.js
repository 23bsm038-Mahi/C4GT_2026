import Header from '../components/Header';
import LessonList from '../components/LessonList';

function CourseDetailPage({ student, course, onBack, onLogout }) {
  return (
    <div className="page-layout">
      <Header
        title={course.title}
        subtitle={`Student: ${student.name} | Mobile: ${student.mobile}`}
      >
        <button type="button" className="secondary-button" onClick={onBack}>
          Back to Dashboard
        </button>
        <button type="button" className="secondary-button" onClick={onLogout}>
          Logout
        </button>
      </Header>

      <div className="detail-grid">
        <div className="detail-section page-card">
          <h3>Course Lessons</h3>
          <LessonList lessons={course.lessons} />
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

          <h3>Quick Notes</h3>
          <ul className="info-list">
            <li>This course is suitable for beginners.</li>
            <li>Try to complete one lesson every day.</li>
            <li>Review the dashboard to continue with other topics.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default CourseDetailPage;
