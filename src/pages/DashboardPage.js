import CourseCard from '../components/CourseCard';
import Header from '../components/Header';

function DashboardPage({ student, courses, onOpenCourse, onLogout }) {
  return (
    <div className="page-layout">
      <Header
        title={`Welcome, ${student.name}`}
        subtitle="Here are your current GovTech courses for this week."
      >
        <button type="button" className="secondary-button" onClick={onLogout}>
          Logout
        </button>
      </Header>

      <div className="course-grid">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} onOpenCourse={onOpenCourse} />
        ))}
      </div>
    </div>
  );
}

export default DashboardPage;
