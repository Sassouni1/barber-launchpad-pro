import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function LessonLegacyRedirect() {
  const navigate = useNavigate();
  const { lessonId } = useParams();

  useEffect(() => {
    if (lessonId) {
      navigate(`/courses/lesson/${lessonId}`, { replace: true });
      return;
    }

    navigate("/courses", { replace: true });
  }, [lessonId, navigate]);

  return null;
}
