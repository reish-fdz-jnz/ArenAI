import React, { useState, useEffect, useCallback } from "react";
import {
  IonPage,
  IonContent,
  IonIcon,
  IonModal,
  IonSearchbar,
  IonHeader,
  IonToolbar,
  IonMenuButton,
  useIonToast,
  useIonViewWillEnter,
  useIonAlert,
} from "@ionic/react";
import {
  menu,
  filterOutline,
  downloadOutline,
  star,
  starOutline,
  sparklesOutline,
  eyeOutline,
  createOutline,
  addOutline,
  closeOutline,
  trashOutline,
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import ProfessorMenu from "../components/ProfessorMenu";
import PageTransition from "../components/PageTransition";
import { getApiUrl } from "../config/api";
import "./QuizMenu.css";
import "../components/ProfessorHeader.css";

// Quiz interface
interface Quiz {
  id: string;
  name: string;
  subject: string;
  grade: number;
  description: string;
  topics: string[];
  questions: { text: string; points: number }[];
  createdAt: string;
  creatorId: string;
  creatorName: string;
  originalCreatorName?: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  isOwned: boolean;
}

// Mock data - Your Quizzes
const MY_QUIZZES: Quiz[] = [
  {
    id: "my1",
    name: "Algebra Basics",
    subject: "Math",
    grade: 7,
    description: "Introduction to algebraic expressions and equations",
    topics: ["Algebra", "Linear Equations"],
    questions: [
      { text: "Solve for x: 2x + 4 = 10", points: 1.5 },
      { text: "What is the value of y in 3y - 9 = 0?", points: 1.5 },
      { text: "Simplify: 5x + 3x - 2x", points: 1.0 },
    ],
    createdAt: "2026-01-15",
    creatorId: "me",
    creatorName: "You",
    downloads: 12,
    rating: 4.5,
    ratingCount: 8,
    isOwned: true,
  },
  {
    id: "my2",
    name: "Geometry Fundamentals",
    subject: "Math",
    grade: 8,
    description: "Basic concepts of shapes and measurements",
    topics: ["Geometry", "Trigonometry"],
    questions: [
      { text: "What is the area of a circle with radius 5?", points: 2.0 },
      { text: "Calculate the perimeter of a rectangle 4x6", points: 1.0 },
    ],
    createdAt: "2026-01-10",
    creatorId: "me",
    creatorName: "You",
    originalCreatorName: "Prof. Garcia",
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    isOwned: true,
  },
];

// Mock data - Popular Quizzes from other teachers
const POPULAR_QUIZZES: Quiz[] = [
  {
    id: "pop1",
    name: "Statistics Mastery",
    subject: "Math",
    grade: 9,
    description: "Comprehensive statistics review with real-world examples",
    topics: ["Statistics", "Probability"],
    questions: [
      { text: "Find the mean of: 5, 8, 12, 15, 20", points: 1.5 },
      { text: "What is the median of: 3, 7, 9, 11, 14?", points: 1.5 },
      { text: "Calculate the mode of: 2, 4, 4, 5, 7, 7, 7", points: 1.0 },
      { text: "Define standard deviation", points: 2.0 },
    ],
    createdAt: "2026-01-12",
    creatorId: "teacher1",
    creatorName: "Prof. Martinez",
    downloads: 156,
    rating: 4.8,
    ratingCount: 42,
    isOwned: false,
  },
  {
    id: "pop2",
    name: "Calculus Introduction",
    subject: "Math",
    grade: 10,
    description: "Derivatives and integrals basics for beginners",
    topics: ["Calculus", "Algebra"],
    questions: [
      { text: "Find the derivative of f(x) = x²", points: 2.0 },
      { text: "What is the integral of 2x?", points: 2.0 },
      { text: "Explain the concept of limits", points: 1.5 },
    ],
    createdAt: "2026-01-08",
    creatorId: "teacher2",
    creatorName: "Prof. Johnson",
    downloads: 234,
    rating: 4.6,
    ratingCount: 67,
    isOwned: false,
  },
  {
    id: "pop3",
    name: "Biology Essentials",
    subject: "Science",
    grade: 8,
    description: "Cell structure and basic biology concepts",
    topics: ["Biology", "Chemistry"],
    questions: [
      { text: "What is the powerhouse of the cell?", points: 1.0 },
      { text: "Describe the process of photosynthesis", points: 2.0 },
      { text: "Name the parts of a plant cell", points: 1.5 },
    ],
    createdAt: "2026-01-05",
    creatorId: "teacher3",
    creatorName: "Prof. Lee",
    downloads: 89,
    rating: 4.2,
    ratingCount: 23,
    isOwned: false,
  },
  {
    id: "pop4",
    name: "Physics Fundamentals",
    subject: "Science",
    grade: 9,
    description: "Newton's laws and basic mechanics",
    topics: ["Physics"],
    questions: [
      { text: "State Newton's first law of motion", points: 1.5 },
      { text: "Calculate F if m=5kg and a=10m/s²", points: 1.5 },
    ],
    createdAt: "2026-01-02",
    creatorId: "teacher4",
    creatorName: "Prof. Chen",
    downloads: 312,
    rating: 4.9,
    ratingCount: 89,
    isOwned: false,
  },
];

const QuizMenu: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [present] = useIonToast();
  const [presentAlert] = useIonAlert();

  // Header state
  const [selectedGrade, setSelectedGrade] = useState(7);
  const [selectedSubject, setSelectedSubject] = useState("Math");
  const [currentSection, setCurrentSection] = useState("7-1");

  // Quiz lists - start empty, fetch from DB
  const [myQuizzes, setMyQuizzes] = useState<Quiz[]>([]);
  const [popularQuizzes, setPopularQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [mySearch, setMySearch] = useState("");
  const [popularSearch, setPopularSearch] = useState("");

  // Modal state
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [userRating, setUserRating] = useState(0);

  // Fetch quizzes from database
  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const token =
          localStorage.getItem("authToken") || localStorage.getItem("token");
        const userStr =
          localStorage.getItem("userData") || localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : null;

        if (token && user?.id) {
          // Fetch professor's own quizzes
          const response = await fetch(
            getApiUrl(`/api/quizzes/professor/${user.id}`),
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          if (response.ok) {
            const data = await response.json();
            // Transform database format to UI format
            const quizzes: Quiz[] = (data.quizzes || []).map((q: any) => {
              // Create placeholder questions based on count
              const questionCount = q.question_count || 0;
              const placeholderQuestions = Array.from(
                { length: questionCount },
                (_, i) => ({
                  text: `Question ${i + 1}`,
                  points: 1,
                }),
              );

              return {
                id: String(q.id_quiz),
                name: q.quiz_name,
                subject: q.id_subject === 1 ? "Math" : "Science",
                grade: 7,
                description: q.description || "",
                topics: [],
                questions: placeholderQuestions,
                createdAt: q.created_at || new Date().toISOString(),
                creatorId: String(q.id_professor),
                creatorName: "You",
                downloads: 0,
                rating: 0,
                ratingCount: 0,
                isOwned: true,
              };
            });
            setMyQuizzes(quizzes);
          }

          // Also fetch public quizzes for Popular section
          const publicResponse = await fetch(
            getApiUrl(`/api/quizzes/public?excludeUser=${user.id}`),
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          if (publicResponse.ok) {
            const publicData = await publicResponse.json();
            const publicQuizzes: Quiz[] = (publicData.quizzes || []).map(
              (q: any) => {
                const questionCount = q.question_count || 0;
                const placeholderQuestions = Array.from(
                  { length: questionCount },
                  (_, i) => ({
                    text: `Question ${i + 1}`,
                    points: 1,
                  }),
                );

                return {
                  id: String(q.id_quiz),
                  name: q.quiz_name,
                  subject: q.id_subject === 1 ? "Math" : "Science",
                  grade: 7,
                  description: q.description || "",
                  topics: [],
                  questions: placeholderQuestions,
                  createdAt: q.created_at || new Date().toISOString(),
                  creatorId: String(q.id_professor),
                  creatorName:
                    q.first_name && q.last_name
                      ? `Prof. ${q.last_name}`
                      : "Anonymous",
                  downloads: q.downloads || 0,
                  rating: parseFloat(q.avg_rating) || 0,
                  ratingCount: q.rating_count || 0,
                  isOwned: false,
                };
              },
            );
            setPopularQuizzes(publicQuizzes);
          }
        }
      } catch (error) {
        console.error("Error fetching quizzes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, []);

  // Auto-reload quizzes when page becomes visible (e.g., after saving a new quiz)
  useIonViewWillEnter(() => {
    const reloadQuizzes = async () => {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const userStr =
        localStorage.getItem("userData") || localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;

      if (token && user?.id) {
        try {
          const response = await fetch(
            getApiUrl(`/api/quizzes/professor/${user.id}`),
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          if (response.ok) {
            const data = await response.json();
            const quizzes: Quiz[] = (data.quizzes || []).map((q: any) => {
              const questionCount = q.question_count || 0;
              const placeholderQuestions = Array.from(
                { length: questionCount },
                (_, i) => ({
                  text: `Question ${i + 1}`,
                  points: 1,
                }),
              );

              return {
                id: String(q.id_quiz),
                name: q.quiz_name,
                subject: q.id_subject === 1 ? "Math" : "Science",
                grade: 7,
                description: q.description || "",
                topics: [],
                questions: placeholderQuestions,
                createdAt: q.created_at || new Date().toISOString(),
                creatorId: String(q.id_professor),
                creatorName: "You",
                downloads: 0,
                rating: 0,
                ratingCount: 0,
                isOwned: true,
              };
            });
            setMyQuizzes(quizzes);
          }
        } catch (error) {
          console.error("Error reloading quizzes:", error);
        }
      }
    };
    reloadQuizzes();
  });

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Render rating stars
  const renderStars = (rating: number, size: "small" | "large" = "small") => {
    const stars = [];
    const fullStars = Math.floor(rating);
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <IonIcon
          key={i}
          icon={i <= fullStars ? star : starOutline}
          className={`quiz-menu-star ${i > fullStars ? "empty" : ""}`}
          style={{ fontSize: size === "large" ? "28px" : "12px" }}
        />,
      );
    }
    return stars;
  };

  // Delete quiz
  const confirmDelete = (e: React.MouseEvent, quizId: string) => {
    e.stopPropagation();
    presentAlert({
      header: "Delete Quiz",
      message:
        "Are you sure you want to delete this quiz? This cannot be undone.",
      buttons: [
        "Cancel",
        {
          text: "Delete",
          role: "destructive",
          handler: () => handleDeleteQuiz(quizId),
        },
      ],
    });
  };

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(getApiUrl(`/api/quizzes/${quizId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setMyQuizzes(myQuizzes.filter((q) => q.id !== quizId));
        present({
          message: "Quiz deleted successfully",
          duration: 2000,
          color: "success",
        });
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      console.error("Error deleting quiz:", error);
      present({
        message: "Failed to delete quiz",
        duration: 2000,
        color: "danger",
      });
    }
  };

  // Open quiz detail
  const openQuizDetail = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setUserRating(0);
    setShowDetailModal(true);
  };

  // Add quiz to my collection
  const addToMyQuizzes = (quiz: Quiz) => {
    const newQuiz: Quiz = {
      ...quiz,
      id: `my${Date.now()}`,
      originalCreatorName: quiz.creatorName,
      creatorName: "You",
      creatorId: "me",
      isOwned: true,
      downloads: 0,
      rating: 0,
      ratingCount: 0,
    };

    setMyQuizzes([newQuiz, ...myQuizzes]);

    // Increment download counter on original
    setPopularQuizzes(
      popularQuizzes.map((q) =>
        q.id === quiz.id ? { ...q, downloads: q.downloads + 1 } : q,
      ),
    );

    present({
      message: `"${quiz.name}" added to your quizzes!`,
      duration: 2000,
      color: "success",
    });

    setShowDetailModal(false);
  };

  // Rate quiz
  const rateQuiz = (rating: number) => {
    setUserRating(rating);
    if (selectedQuiz && !selectedQuiz.isOwned) {
      setPopularQuizzes(
        popularQuizzes.map((q) =>
          q.id === selectedQuiz.id
            ? {
                ...q,
                rating:
                  (q.rating * q.ratingCount + rating) / (q.ratingCount + 1),
                ratingCount: q.ratingCount + 1,
              }
            : q,
        ),
      );
      present({
        message: `Rated ${rating} stars!`,
        duration: 1500,
        color: "success",
      });
    }
  };

  // Navigate to preview
  const goToPreview = (quiz: Quiz) => {
    sessionStorage.removeItem("generatedQuiz"); // Clear any stale AI data
    sessionStorage.setItem(
      "previewQuiz",
      JSON.stringify({
        quizId: quiz.id, // Include quiz ID for fetching from database
        quizName: quiz.name,
        subject: quiz.subject,
        isOwned: quiz.isOwned,
        fromDatabase: true, // Flag to indicate we need to fetch questions from API
        questions: [], // Empty - will be fetched from API
      }),
    );
    setShowDetailModal(false);
    history.push("/page/quiz-preview");
  };

  // Navigate to AI generator
  const goToGenerator = () => {
    history.push("/page/ai-quiz-generator");
  };

  // Filter quizzes
  const filteredMyQuizzes = myQuizzes.filter(
    (q) =>
      q.name.toLowerCase().includes(mySearch.toLowerCase()) ||
      q.subject.toLowerCase().includes(mySearch.toLowerCase()),
  );

  const filteredPopularQuizzes = popularQuizzes.filter(
    (q) =>
      q.name.toLowerCase().includes(popularSearch.toLowerCase()) ||
      q.subject.toLowerCase().includes(popularSearch.toLowerCase()),
  );

  return (
    <IonPage className="quiz-menu-page">
      {/* Professor Header */}
      <IonHeader className="professor-header-container">
        <IonToolbar color="primary" className="professor-toolbar">
          <div className="ph-content">
            <IonMenuButton className="ph-menu-btn">
              <IonIcon icon={menu} />
            </IonMenuButton>
          </div>
        </IonToolbar>

        {/* Brand / Title */}
        <div className="ph-brand-container-absolute">
          <div className="ph-brand-name">ArenAI</div>
          <div className="ph-brand-sub">Quiz Menu</div>
        </div>

        {/* Notch with dropdowns */}
        <div className="ph-notch-container">
          <div className="ph-notch">
            <div className="ph-dropdowns-display">
              <div className="ph-text-oval">
                <ProfessorMenu
                  selectedGrade={String(selectedGrade)}
                  selectedSection={currentSection.split("-")[1] || "1"}
                  selectedSubject={t(
                    "professor.dashboard.subjects." +
                      selectedSubject.replace(/\s+/g, ""),
                  )}
                  onGradeChange={(grade) =>
                    setSelectedGrade(parseInt(grade, 10))
                  }
                  onSectionChange={(section) =>
                    setCurrentSection(`${selectedGrade}-${section}`)
                  }
                  onSubjectChange={setSelectedSubject}
                />
              </div>
            </div>
          </div>
        </div>
      </IonHeader>

      <IonContent className="quiz-menu-content">
        <PageTransition>
          <div className="quiz-menu-container">
            {/* ========== YOUR QUIZZES SECTION ========== */}
            <div className="quiz-menu-section">
              <div className="quiz-menu-section-header">
                <h2 className="quiz-menu-section-title">
                  Your Quizzes
                  <span className="quiz-menu-section-count">
                    {filteredMyQuizzes.length}
                  </span>
                </h2>
              </div>

              <div className="quiz-menu-search-row">
                <IonSearchbar
                  className="quiz-menu-searchbar"
                  value={mySearch}
                  onIonInput={(e) => setMySearch(e.detail.value || "")}
                  placeholder="Search your quizzes..."
                />
                <button className="quiz-menu-filter-btn">
                  <IonIcon icon={filterOutline} />
                </button>
              </div>

              {filteredMyQuizzes.length === 0 ? (
                <div className="quiz-menu-empty">
                  No quizzes found. Create one with AI!
                </div>
              ) : (
                <div className="quiz-menu-grid">
                  {filteredMyQuizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      className="quiz-menu-card"
                      onClick={() => openQuizDetail(quiz)}
                    >
                      <div className="quiz-menu-card-header">
                        <div>
                          <span className="quiz-menu-card-name">
                            {quiz.name}
                          </span>
                          <span className="quiz-menu-card-meta">
                            {quiz.subject} • Grade {quiz.grade}
                          </span>
                        </div>
                        {quiz.isOwned && (
                          <button
                            className="quiz-menu-delete-btn"
                            onClick={(e) => confirmDelete(e, quiz.id)}
                          >
                            <IonIcon icon={trashOutline} />
                          </button>
                        )}
                      </div>

                      {quiz.originalCreatorName && (
                        <span className="quiz-menu-card-creator">
                          Originally by {quiz.originalCreatorName}
                        </span>
                      )}

                      <div className="quiz-menu-card-date">
                        Created: {formatDate(quiz.createdAt)}
                      </div>

                      <div className="quiz-menu-card-topics">
                        {quiz.topics.slice(0, 2).map((topic, i) => (
                          <span key={i} className="quiz-menu-topic-chip">
                            {topic}
                          </span>
                        ))}
                      </div>

                      <div className="quiz-menu-card-actions">
                        <button
                          className="quiz-menu-action-btn secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToPreview(quiz);
                          }}
                        >
                          <IonIcon icon={eyeOutline} /> Preview
                        </button>
                        <button
                          className="quiz-menu-action-btn primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToPreview(quiz);
                          }}
                        >
                          <IonIcon icon={createOutline} /> Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ========== POPULAR QUIZZES SECTION ========== */}
            <div className="quiz-menu-section">
              <div className="quiz-menu-section-header">
                <h2 className="quiz-menu-section-title">
                  Popular Quizzes
                  <span className="quiz-menu-section-count">
                    {filteredPopularQuizzes.length}
                  </span>
                </h2>
              </div>

              <div className="quiz-menu-search-row">
                <IonSearchbar
                  className="quiz-menu-searchbar"
                  value={popularSearch}
                  onIonInput={(e) => setPopularSearch(e.detail.value || "")}
                  placeholder="Search popular quizzes..."
                />
                <button className="quiz-menu-filter-btn">
                  <IonIcon icon={filterOutline} />
                </button>
              </div>

              {filteredPopularQuizzes.length === 0 ? (
                <div className="quiz-menu-empty">No popular quizzes found.</div>
              ) : (
                <div className="quiz-menu-grid">
                  {filteredPopularQuizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      className="quiz-menu-card"
                      onClick={() => openQuizDetail(quiz)}
                    >
                      <div className="quiz-menu-card-header">
                        <span className="quiz-menu-card-name">{quiz.name}</span>
                        <span className="quiz-menu-card-meta">
                          {quiz.subject} • Grade {quiz.grade}
                        </span>
                      </div>

                      <span className="quiz-menu-card-creator">
                        by {quiz.creatorName}
                      </span>

                      <div className="quiz-menu-card-stats">
                        <div className="quiz-menu-card-downloads">
                          <IonIcon icon={downloadOutline} />
                          {quiz.downloads}
                        </div>
                        <div className="quiz-menu-card-rating">
                          {renderStars(quiz.rating)}
                          <span className="quiz-menu-rating-number">
                            {quiz.rating.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <div className="quiz-menu-card-topics">
                        {quiz.topics.slice(0, 2).map((topic, i) => (
                          <span key={i} className="quiz-menu-topic-chip">
                            {topic}
                          </span>
                        ))}
                      </div>

                      <div className="quiz-menu-card-actions">
                        <button
                          className="quiz-menu-action-btn secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToPreview(quiz);
                          }}
                        >
                          <IonIcon icon={eyeOutline} /> Preview
                        </button>
                        <button
                          className="quiz-menu-action-btn primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToMyQuizzes(quiz);
                          }}
                        >
                          <IonIcon icon={addOutline} /> Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Spacer */}
            <div className="quiz-menu-footer-spacer"></div>
          </div>
        </PageTransition>
      </IonContent>

      {/* Footer */}
      <div className="quiz-menu-footer">
        <button className="quiz-menu-generate-btn" onClick={goToGenerator}>
          <IonIcon icon={sparklesOutline} />
          Generate with AI
        </button>
      </div>

      {/* ========== QUIZ DETAIL MODAL ========== */}
      <IonModal
        isOpen={showDetailModal}
        onDidDismiss={() => setShowDetailModal(false)}
        className="quiz-menu-detail-modal"
      >
        {selectedQuiz && (
          <div className="quiz-menu-detail-content">
            <div className="quiz-menu-detail-header">
              <h2 className="quiz-menu-detail-title">{selectedQuiz.name}</h2>
              <span className="quiz-menu-detail-subject">
                {selectedQuiz.subject} • Grade {selectedQuiz.grade}
              </span>
              <div className="quiz-menu-detail-meta">
                Created: {formatDate(selectedQuiz.createdAt)} •{" "}
                {selectedQuiz.questions.length} questions
              </div>
            </div>

            {/* Ownership Chain */}
            <div className="quiz-menu-detail-ownership">
              <div className="quiz-menu-ownership-label">Created by</div>
              <div className="quiz-menu-ownership-chain">
                {selectedQuiz.originalCreatorName && (
                  <>
                    <span>{selectedQuiz.originalCreatorName}</span>
                    <span className="quiz-menu-ownership-arrow">→</span>
                  </>
                )}
                <span>{selectedQuiz.creatorName}</span>
              </div>
            </div>

            {/* Stats for popular quizzes */}
            {!selectedQuiz.isOwned && (
              <div className="quiz-menu-detail-stats">
                <div className="quiz-menu-detail-stat">
                  <div className="quiz-menu-detail-stat-value">
                    {selectedQuiz.downloads}
                  </div>
                  <div className="quiz-menu-detail-stat-label">Downloads</div>
                </div>
                <div className="quiz-menu-detail-stat">
                  <div className="quiz-menu-detail-stat-value">
                    {selectedQuiz.rating.toFixed(1)}
                  </div>
                  <div className="quiz-menu-detail-stat-label">
                    Rating ({selectedQuiz.ratingCount})
                  </div>
                </div>
              </div>
            )}

            <p className="quiz-menu-detail-description">
              {selectedQuiz.description}
            </p>

            {/* Topics */}
            <div className="quiz-menu-detail-section">
              <h3 className="quiz-menu-detail-section-title">Topics</h3>
              <div className="quiz-menu-detail-topics">
                {selectedQuiz.topics.map((topic, i) => (
                  <span key={i} className="quiz-menu-topic-chip">
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            {/* Questions Preview */}
            <div className="quiz-menu-detail-section">
              <h3 className="quiz-menu-detail-section-title">
                Questions ({selectedQuiz.questions.length})
              </h3>
              <div className="quiz-menu-detail-questions">
                {selectedQuiz.questions.slice(0, 3).map((q, i) => (
                  <div key={i} className="quiz-menu-question-preview">
                    <span className="quiz-menu-question-number">{i + 1}.</span>
                    <span className="quiz-menu-question-text">{q.text}</span>
                  </div>
                ))}
                {selectedQuiz.questions.length > 3 && (
                  <div className="quiz-menu-more-questions">
                    +{selectedQuiz.questions.length - 3} more questions...
                  </div>
                )}
              </div>
            </div>

            {/* Rating for popular quizzes */}
            {!selectedQuiz.isOwned && (
              <div className="quiz-menu-rating-section">
                <h3 className="quiz-menu-detail-section-title">
                  Rate this quiz
                </h3>
                <div className="quiz-menu-rating-stars">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <IonIcon
                      key={i}
                      icon={i <= userRating ? star : starOutline}
                      className={`quiz-menu-rating-star ${
                        i <= userRating ? "active" : ""
                      }`}
                      onClick={() => rateQuiz(i)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="quiz-menu-detail-buttons">
              <button
                className="quiz-menu-detail-btn secondary"
                onClick={() => goToPreview(selectedQuiz)}
              >
                <IonIcon icon={eyeOutline} />
                Preview Quiz
              </button>

              {selectedQuiz.isOwned ? (
                <button
                  className="quiz-menu-detail-btn primary"
                  onClick={() => goToPreview(selectedQuiz)}
                >
                  <IonIcon icon={createOutline} />
                  Edit Quiz
                </button>
              ) : (
                <button
                  className="quiz-menu-detail-btn primary"
                  onClick={() => addToMyQuizzes(selectedQuiz)}
                >
                  <IonIcon icon={addOutline} />
                  Add to My Quizzes
                </button>
              )}

              <button
                className="quiz-menu-close-btn"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </IonModal>
    </IonPage>
  );
};

export default QuizMenu;
