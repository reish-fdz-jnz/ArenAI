import React, { useState } from "react";
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonModal,
  IonIcon,
  useIonToast,
  useIonViewWillEnter,
} from "@ionic/react";
import {
  createOutline,
  trashOutline,
  addCircleOutline,
  checkmarkOutline,
  refreshOutline,
  arrowBackOutline,
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import { getApiUrl } from "../config/api";
import "../components/StudentHeader.css";
import "./QuizPreview.css";

// Quiz data structure matching database schema
interface Answer {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  text: string;
  topic: string;
  topicId?: number | null;
  points: number;
  allowMultipleSelection: boolean;
  answers: Answer[];
}

// Interface for AI-generated question format
interface AIQuestion {
  question_text: string;
  topic: string;
  topicId?: number | null;
  points: number;
  allow_multiple_selection: boolean;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_options: number[];
}

const QuizPreview: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [present] = useIonToast();

  // Ownership state - check if this is user's quiz
  const [isOwned, setIsOwned] = useState(true);

  // Quiz state
  const [quizName, setQuizName] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [gradeLevel, setGradeLevel] = useState<number>(7);
  const [language, setLanguage] = useState("en"); // Default to en, but will overwrite
  const [subject, setSubject] = useState("Math"); // Default to Math
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<
    { id_subject: number; name_subject: string }[]
  >([]);

  // Load generated quiz from sessionStorage on enter
  useIonViewWillEnter(() => {
    // Fetch subjects dynamically
    // Fetch subjects dynamically with auth token
    const token =
      localStorage.getItem("authToken") || localStorage.getItem("token");
    fetch(getApiUrl("/api/subjects"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch subjects");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setSubjects(data);
      })
      .catch((err) => console.error("Failed to fetch subjects:", err));

    const storedQuiz = sessionStorage.getItem("generatedQuiz");
    const previewQuiz = sessionStorage.getItem("previewQuiz");

    // If loaded from QuizMenu (preview), use previewQuiz and set isOwned
    if (previewQuiz) {
      try {
        const parsed = JSON.parse(previewQuiz);
        if (parsed.quizName) setQuizName(parsed.quizName);
        if (parsed.isOwned !== undefined) setIsOwned(parsed.isOwned);
        // Grade from preview usually not stored, default or fetch?
        if (parsed.level) setGradeLevel(parsed.level);
        if (parsed.subject) setSubject(parsed.subject);
        if (parsed.language)
          setLanguage(
            parsed.language === "Spanish"
              ? "es"
              : parsed.language === "Chinese"
                ? "zh"
                : "en",
          );

        // If from database, fetch questions from API
        if (parsed.fromDatabase && parsed.quizId) {
          const token =
            localStorage.getItem("authToken") || localStorage.getItem("token");
          fetch(getApiUrl(`/api/quizzes/${parsed.quizId}/full`), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.quiz?.questions) {
                const transformedQuestions: Question[] =
                  data.quiz.questions.map((q: any, index: number) => {
                    const correctOptions =
                      typeof q.correct_options === "string"
                        ? JSON.parse(q.correct_options)
                        : q.correct_options || [1];
                    return {
                      id: `q${index + 1}`,
                      text: q.question_text,
                      topic: "General",
                      points: parseFloat(q.points) || 1.0,
                      allowMultipleSelection:
                        q.allow_multiple_selection || false,
                      answers: [
                        {
                          id: `q${index + 1}-a1`,
                          text: q.option_1,
                          isCorrect: correctOptions.includes(1),
                        },
                        {
                          id: `q${index + 1}-a2`,
                          text: q.option_2,
                          isCorrect: correctOptions.includes(2),
                        },
                        {
                          id: `q${index + 1}-a3`,
                          text: q.option_3 || "",
                          isCorrect: correctOptions.includes(3),
                        },
                        {
                          id: `q${index + 1}-a4`,
                          text: q.option_4 || "",
                          isCorrect: correctOptions.includes(4),
                        },
                      ].filter((a) => a.text), // Remove empty answers
                    };
                  });
                setQuestions(transformedQuestions);
              }
            })
            .catch((err) =>
              console.error("Error fetching quiz questions:", err),
            );
        } else if (parsed.questions && Array.isArray(parsed.questions)) {
          const transformedQuestions: Question[] = parsed.questions.map(
            (q: any, index: number) => {
              const correctOptions = q.correct_options || [1];
              return {
                id: `q${index + 1}`,
                text: q.text || q.question_text || "",
                topic: q.topic || "General",
                topicId: q.topicId || null,
                points: q.points || 1.0,
                allowMultipleSelection: q.allowMultipleSelection !== undefined 
                  ? q.allowMultipleSelection 
                  : (q.allow_multiple_selection || false),
                answers: q.answers ? q.answers.map((a: any, aIdx: number) => ({
                    id: `q${index + 1}-a${aIdx + 1}`,
                    text: a.text,
                    isCorrect: !!a.isCorrect
                })) : [
                  {
                    id: `q${index + 1}-a1`,
                    text: q.option_1,
                    isCorrect: correctOptions.includes(1),
                  },
                  {
                    id: `q${index + 1}-a2`,
                    text: q.option_2,
                    isCorrect: correctOptions.includes(2),
                  },
                  {
                    id: `q${index + 1}-a3`,
                    text: q.option_3,
                    isCorrect: correctOptions.includes(3),
                  },
                  {
                    id: `q${index + 1}-a4`,
                    text: q.option_4,
                    isCorrect: correctOptions.includes(4),
                  },
                ],
              };
            },
          );
          setQuestions(transformedQuestions);
        }
      } catch (error) {
        console.error("Error parsing preview quiz:", error);
      }
    } else if (storedQuiz) {
      try {
        const parsed = JSON.parse(storedQuiz);

        if (parsed.quizName) {
          setQuizName(parsed.quizName);
        }
        if (parsed.gradeLevel) {
          setGradeLevel(parsed.gradeLevel);
        }
        if (parsed.language) {
          // Map full name back to code for DB if needed, or keep full name?
          // Backend expects 'en', 'es', 'zh' usually?
          // Actually backend types don't specify, but DB probably prefers codes.
          // AIGenerator uses "English", "Spanish", "Chinese".
          // Let's map them.
          const langMap: Record<string, string> = {
            English: "en",
            Spanish: "es",
            Chinese: "zh",
          };
          setLanguage(langMap[parsed.language] || "en");
        }
        if (parsed.subject) setSubject(parsed.subject);

        // Transform AI questions to component format
        if (parsed.questions && Array.isArray(parsed.questions)) {
          const transformedQuestions: Question[] = parsed.questions.map(
            (q: any, index: number) => {
              const correctOptions = q.correct_options || [1];
              return {
                id: `q${index + 1}`,
                text: q.text || q.question_text || "",
                topic: q.topic || "General",
                topicId: q.topicId || null,
                points: q.points || 1.0,
                allowMultipleSelection: q.allowMultipleSelection !== undefined 
                  ? q.allowMultipleSelection 
                  : (q.allow_multiple_selection || false),
                answers: q.answers ? q.answers.map((a: any, aIdx: number) => ({
                    id: `q${index + 1}-a${aIdx + 1}`,
                    text: a.text,
                    isCorrect: !!a.isCorrect
                })) : [
                  {
                    id: `q${index + 1}-a1`,
                    text: q.option_1,
                    isCorrect: correctOptions.includes(1),
                  },
                  {
                    id: `q${index + 1}-a2`,
                    text: q.option_2,
                    isCorrect: correctOptions.includes(2),
                  },
                  {
                    id: `q${index + 1}-a3`,
                    text: q.option_3,
                    isCorrect: correctOptions.includes(3),
                  },
                  {
                    id: `q${index + 1}-a4`,
                    text: q.option_4,
                    isCorrect: correctOptions.includes(4),
                  },
                ],
              };
            },
          );
          setQuestions(transformedQuestions);
        }
      } catch (error) {
        console.error("Error parsing stored quiz:", error);
      }
    }
  });

  // Modal states
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState("");

  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [tempQuestionText, setTempQuestionText] = useState("");
  const [tempQuestionPoints, setTempQuestionPoints] = useState("1.00");
  const [tempAllowMultiple, setTempAllowMultiple] = useState(false);

  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [editingAnswer, setEditingAnswer] = useState<{
    questionId: string;
    answer: Answer;
  } | null>(null);
  const [tempAnswerText, setTempAnswerText] = useState("");
  const [tempAnswerCorrect, setTempAnswerCorrect] = useState(false);

  // Name modal handlers
  const openNameModal = () => {
    setTempName(quizName);
    setShowNameModal(true);
  };

  const saveQuizName = () => {
    if (tempName.trim()) {
      setQuizName(tempName.trim());
    }
    setShowNameModal(false);
  };

  // Question modal handlers
  const openQuestionModal = (question: Question) => {
    setEditingQuestion(question);
    setTempQuestionText(question.text);
    setTempQuestionPoints(question.points.toFixed(2));
    setTempAllowMultiple(question.allowMultipleSelection);
    setShowQuestionModal(true);
  };

  const saveQuestion = () => {
    if (editingQuestion && tempQuestionText.trim()) {
      const points = parseFloat(tempQuestionPoints) || 1.0;
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === editingQuestion.id
            ? {
                ...q,
                text: tempQuestionText.trim(),
                points: Math.min(3.0, Math.max(1.0, points)),
                allowMultipleSelection: tempAllowMultiple,
              }
            : q,
        ),
      );
    }
    setShowQuestionModal(false);
    setEditingQuestion(null);
  };

  const deleteQuestion = () => {
    if (editingQuestion) {
      setQuestions((prev) => prev.filter((q) => q.id !== editingQuestion.id));
    }
    setShowQuestionModal(false);
    setEditingQuestion(null);
  };

  // Answer modal handlers
  const openAnswerModal = (questionId: string, answer: Answer) => {
    setEditingAnswer({ questionId, answer });
    setTempAnswerText(answer.text);
    setTempAnswerCorrect(answer.isCorrect);
    setShowAnswerModal(true);
  };

  const saveAnswer = () => {
    if (editingAnswer) {
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === editingAnswer.questionId
            ? {
                ...q,
                answers: q.answers.map((a) =>
                  a.id === editingAnswer.answer.id
                    ? {
                        ...a,
                        text: tempAnswerText.trim(),
                        isCorrect: tempAnswerCorrect,
                      }
                    : a,
                ),
              }
            : q,
        ),
      );
    }
    setShowAnswerModal(false);
    setEditingAnswer(null);
  };

  const deleteAnswer = () => {
    if (editingAnswer) {
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === editingAnswer.questionId
            ? {
                ...q,
                answers: q.answers.filter(
                  (a) => a.id !== editingAnswer.answer.id,
                ),
              }
            : q,
        ),
      );
    }
    setShowAnswerModal(false);
    setEditingAnswer(null);
  };

  // Add new question
  const addNewQuestion = () => {
    const newId = `q${Date.now()}`;
    const newQuestion: Question = {
      id: newId,
      text: "New question text here...",
      topic: "General",
      points: 1.0,
      allowMultipleSelection: false,
      answers: [
        { id: `${newId}-a1`, text: "Answer 1", isCorrect: true },
        { id: `${newId}-a2`, text: "Answer 2", isCorrect: false },
        { id: `${newId}-a3`, text: "Answer 3", isCorrect: false },
        { id: `${newId}-a4`, text: "Answer 4", isCorrect: false },
      ],
    };
    setQuestions((prev) => [...prev, newQuestion]);
  };

  // Regenerate quiz handler
  const handleRegenerate = () => {
    console.log("Regenerating quiz...");
    window.location.href = "/page/ai-quiz-generator";
  };

  // Save quiz handler - calls backend API
  const handleSaveQuiz = async () => {
    try {
      // Get token - try both possible keys
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const userStr =
        localStorage.getItem("userData") || localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;

      if (!token || !user?.id) {
        present({
          message: "Please log in to save quizzes",
          duration: 2000,
          color: "warning",
        });
        return;
      }

      if (!quizName.trim()) {
        present({
          message: "Please enter a name for the quiz",
          duration: 2000,
          color: "warning",
        });
        openNameModal();
        return;
      }

      // Transform questions to backend format
      const questionsPayload = questions.map((q) => {
        // Find which answers are correct and convert to 1-indexed options
        const correctOptions = q.answers
          .map((a, idx) => (a.isCorrect ? idx + 1 : null))
          .filter((idx) => idx !== null);

        return {
          questionText: q.text,
          topicId: q.topicId || null,
          topicName: q.topic, // Optional fallback
          points: q.points,
          allowMultiple: q.allowMultipleSelection,
          option1: q.answers[0]?.text || "",
          option2: q.answers[1]?.text || "",
          option3: q.answers[2]?.text || null,
          option4: q.answers[3]?.text || null,
          correctOptions: JSON.stringify(correctOptions),
        };
      });

      // Find subject ID
      // Find subject ID
      // Prioritize the subject name currently set in the UI (which should be in sync with 'subject')
      // If we have access to the ID directly, we should use it.
      // But we are storing 'subject' (name) in state.
      // Let's find it in the subjects list.
      let subjectId = 1; // Default

      const foundSubject = subjects.find((s) => s.name_subject === subject);
      if (foundSubject) {
        subjectId = foundSubject.id_subject;
      } else {
        // Fallback fuzzy matching
        const foundFuzzy = subjects.find((s) => {
          const dbName = s.name_subject.toLowerCase();
          const uiName = subject.toLowerCase();
          return (
            dbName === uiName ||
            dbName.includes(uiName) ||
            uiName.includes(dbName)
          );
        });

        if (foundFuzzy) {
          subjectId = foundFuzzy.id_subject;
        } else {
          // Hardcoded fallback for known issues
          if (subject.toLowerCase().includes("spanish")) subjectId = 3;
          else if (subject.toLowerCase().includes("social"))
            subjectId = 4; // Assuming
          else if (subject.toLowerCase().includes("science")) subjectId = 2; // Assuming

          console.warn(
            `Subject '${subject}' not found in DB list. Defaulting/Fallback to ID ${subjectId}`,
          );
        }
      }

      const response = await fetch(getApiUrl("/api/quizzes"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          professorId: user.id,
          subjectId,
          name: quizName,
          description: quizDescription,
          level: String(parseInt(String(gradeLevel), 10) || 7),
          language: language,
          questions: questionsPayload,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save quiz");
      }

      // Navigate directly to quiz library after save (no toast)
      history.push("/page/quiz-menu");
    } catch (error) {
      console.error("Error saving quiz:", error);
      present({
        message: "Failed to save quiz. Please try again.",
        duration: 2000,
        color: "danger",
      });
    }
  };

  // Calculate total points
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <IonPage className="quiz-preview-page">
      <IonHeader className="student-header-container">
        <IonToolbar className="student-toolbar">
          <div className="sh-content">
            <div className="sh-menu-btn-container">
              <button
                className="preview-back-btn"
                onClick={() => history.goBack()}
              >
                <IonIcon icon={arrowBackOutline} />
              </button>
            </div>
          </div>
          <div className="sh-brand-container-absolute">
            <span className="sh-brand-name">ArenAI</span>
            <span className="sh-brand-sub">Preview</span>
          </div>
        </IonToolbar>
        <div className="sh-notch-container">
          <div className="sh-notch">
            {isOwned && (
              <div
                className="sh-subject-display interactive"
                onClick={handleRegenerate}
              >
                <IonIcon
                  icon={refreshOutline}
                  style={{ marginRight: "6px", fontSize: "16px" }}
                />
                <span className="sh-subject-text">Regenerate</span>
              </div>
            )}
          </div>
        </div>
      </IonHeader>

      <IonContent className="quiz-preview-content">
        <PageTransition>
          <div className="preview-container">
            {/* Quiz Title */}
            <div className="preview-title-section">
              <span
                className={`preview-quiz-name ${!quizName ? "placeholder-text" : ""}`}
                onClick={openNameModal}
              >
                {quizName || "Enter Quiz Name"}
                <IonIcon icon={createOutline} className="preview-edit-icon" />
              </span>
              <div className="preview-separator">
                <div className="preview-line"></div>
                <span className="preview-center">❧</span>
                <div className="preview-line"></div>
              </div>
              <div className="preview-total-points">
                Total: {totalPoints.toFixed(2)} pts
              </div>
            </div>


            {/* Questions */}
            {questions.map((question, qIndex) => (
              <div key={question.id} className="preview-question-card">
                {/* Question Header */}
                <div className="preview-question-header">
                  <div className="preview-question-info">
                    <span className="preview-question-number">
                      Question {qIndex + 1}
                    </span>
                    <span className="preview-question-points">
                      {question.points.toFixed(2)} pts
                    </span>
                    {question.allowMultipleSelection && (
                      <span className="preview-question-type">Multiple</span>
                    )}
                  </div>
                  <div className="preview-question-actions">
                    <button
                      className="preview-action-btn"
                      onClick={() => openQuestionModal(question)}
                    >
                      <IonIcon icon={createOutline} />
                    </button>
                    <button
                      className="preview-action-btn delete"
                      onClick={() => {
                        setEditingQuestion(question);
                        deleteQuestion();
                      }}
                    >
                      <IonIcon icon={trashOutline} />
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <div
                  className="preview-question-text"
                  onClick={() => openQuestionModal(question)}
                >
                  {question.text}
                </div>

                {/* Answers */}
                <div className="preview-answers-grid">
                  {question.answers.map((answer) => (
                    <div
                      key={answer.id}
                      className={`preview-answer-item ${
                        answer.isCorrect ? "correct" : ""
                      }`}
                      onClick={() => openAnswerModal(question.id, answer)}
                    >
                      <div className="preview-answer-checkbox">
                        {answer.isCorrect && (
                          <IonIcon
                            icon={checkmarkOutline}
                            className="preview-checkmark"
                          />
                        )}
                      </div>
                      <span className="preview-answer-text">{answer.text}</span>
                      <IonIcon
                        icon={createOutline}
                        className="preview-answer-edit"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Add Question Button */}
            <div className="preview-add-question" onClick={addNewQuestion}>
              <IonIcon icon={addCircleOutline} />
              Add Question
            </div>

            {/* Footer Spacer */}
            <div className="preview-footer-spacer"></div>
          </div>
        </PageTransition>
      </IonContent>

      {/* Footer */}
      <div className="preview-footer">
        <div
          className="preview-save-btn"
          onClick={
            isOwned
              ? handleSaveQuiz
              : () => {
                  // Add to my quizzes functionality would go here
                  console.log("Adding quiz to my collection...");
                }
          }
        >
          {isOwned ? "Save" : "Add"}
        </div>
      </div>

      {/* Quiz Name Modal */}
      <IonModal
        isOpen={showNameModal}
        onDidDismiss={() => setShowNameModal(false)}
        className="preview-edit-modal"
      >
        <div className="preview-modal-inner">
          <h2 className="preview-modal-title">Quiz Name</h2>
          <input
            type="text"
            className="preview-answer-input"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            placeholder="Enter quiz name"
          />
          <div className="preview-modal-buttons">
            <button
              className="preview-modal-btn cancel"
              onClick={() => setShowNameModal(false)}
            >
              Cancel
            </button>
            <button className="preview-modal-btn save" onClick={saveQuizName}>
              Save
            </button>
          </div>
        </div>
      </IonModal>

      {/* Question Edit Modal */}
      <IonModal
        isOpen={showQuestionModal}
        onDidDismiss={() => setShowQuestionModal(false)}
        className="preview-edit-modal"
      >
        <div className="preview-modal-inner">
          <h2 className="preview-modal-title">Edit Question</h2>
          <textarea
            className="preview-question-textarea"
            value={tempQuestionText}
            onChange={(e) => setTempQuestionText(e.target.value)}
            placeholder="Enter question text..."
          />

          {/* Points Input */}
          <div className="preview-points-row">
            <span className="preview-toggle-label">Points (1.00 - 3.00)</span>
            <input
              type="number"
              className="preview-points-input"
              value={tempQuestionPoints}
              onChange={(e) => setTempQuestionPoints(e.target.value)}
              min="1.00"
              max="3.00"
              step="0.50"
            />
          </div>

          {/* Multiple Selection Toggle */}
          <div className="preview-correct-toggle">
            <span className="preview-toggle-label">Allow Multiple Answers</span>
            <div
              className={`preview-toggle-switch ${
                tempAllowMultiple ? "active" : ""
              }`}
              onClick={() => setTempAllowMultiple(!tempAllowMultiple)}
            >
              <div className="preview-toggle-knob"></div>
            </div>
          </div>

          <div className="preview-modal-buttons">
            <button
              className="preview-modal-btn cancel"
              onClick={() => setShowQuestionModal(false)}
            >
              Cancel
            </button>
            <button
              className="preview-modal-btn delete"
              onClick={deleteQuestion}
            >
              Delete
            </button>
            <button className="preview-modal-btn save" onClick={saveQuestion}>
              Save
            </button>
          </div>
        </div>
      </IonModal>

      {/* Answer Edit Modal */}
      <IonModal
        isOpen={showAnswerModal}
        onDidDismiss={() => setShowAnswerModal(false)}
        className="preview-edit-modal"
      >
        <div className="preview-modal-inner">
          <h2 className="preview-modal-title">Edit Answer</h2>
          <input
            type="text"
            className="preview-answer-input"
            value={tempAnswerText}
            onChange={(e) => setTempAnswerText(e.target.value)}
            placeholder="Enter answer text"
          />
          <div className="preview-correct-toggle">
            <span className="preview-toggle-label">Correct Answer</span>
            <div
              className={`preview-toggle-switch ${
                tempAnswerCorrect ? "active" : ""
              }`}
              onClick={() => setTempAnswerCorrect(!tempAnswerCorrect)}
            >
              <div className="preview-toggle-knob"></div>
            </div>
          </div>
          <div className="preview-modal-buttons">
            <button
              className="preview-modal-btn cancel"
              onClick={() => setShowAnswerModal(false)}
            >
              Cancel
            </button>
            <button className="preview-modal-btn delete" onClick={deleteAnswer}>
              Delete
            </button>
            <button className="preview-modal-btn save" onClick={saveAnswer}>
              Save
            </button>
          </div>
        </div>
      </IonModal>
    </IonPage>
  );
};

export default QuizPreview;
