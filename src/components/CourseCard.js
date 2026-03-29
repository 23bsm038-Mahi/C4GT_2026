function CourseCard({ course, onOpenCourse }) {
  return (
    <div className="course-card page-card">
      <span className="course-tag">{course.level}</span>
      <h3>{course.title}</h3>
      <p>{course.description}</p>

      <div className="course-meta">
        <span>{course.lessons.length} lessons</span>
        <span>{course.progress}% complete</span>
      </div>

      <button
        type="button"
        className="primary-button"
        onClick={() => onOpenCourse(course.id)}
      >
        View Course
      </button>
    </div>
  );
}

export default CourseCard;
