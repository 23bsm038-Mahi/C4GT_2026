function LessonList({ lessons }) {
  return (
    <ul className="lesson-list">
      {lessons.map((lesson, index) => (
        <li className="lesson-item" key={lesson.id}>
          <p className="lesson-title">
            Lesson {index + 1}: {lesson.title}
          </p>
          <p className="lesson-time">{lesson.duration}</p>
        </li>
      ))}
    </ul>
  );
}

export default LessonList;
