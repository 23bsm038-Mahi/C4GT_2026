function Dashboard({ student, courses, onOpenCourse, onLogout }) {
  const inProgressCount = courses.filter((course) => course.progress > 0).length;

  return (
    <div className="page-layout">
      <div className="page-header page-card page-hero">
        <div>
          <h2>Welcome, {student.name}</h2>
          <p>Your GovTech learning plan is ready for this week.</p>
        </div>

        <div className="header-actions">
          <button type="button" className="secondary-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="summary-card page-card">
        <p className="summary-title">Student Overview</p>
        <div className="summary-grid">
          <div>
            <span className="summary-label">Mobile</span>
            <p>{student.mobile}</p>
          </div>
          <div>
            <span className="summary-label">Courses</span>
            <p>{courses.length} active courses</p>
          </div>
          <div>
            <span className="summary-label">In Progress</span>
            <p>{inProgressCount} courses started</p>
          </div>
        </div>
      </div>

      <div className="section-header">
        <div>
          <h3>Your Courses</h3>
          <p>Pick a course to continue learning.</p>
        </div>
      </div>

      <div className="course-grid">
        {courses.map((course) => (
          <div key={course.id} className="course-card page-card">
            <span className="course-tag">{course.category}</span>
            <h3>{course.title}</h3>
            <p>{course.description}</p>

            <div className="course-meta">
              <span>{course.lessons.length} lessons</span>
              <span>{course.progress}% complete</span>
            </div>

            <p className="course-extra">Department: {course.department}</p>

            <button
              type="button"
              className="primary-button"
              onClick={() => onOpenCourse(course.id)}
            >
              View Course
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
