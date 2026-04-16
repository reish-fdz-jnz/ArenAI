import React, { useState, useEffect, useRef } from "react";
import {
  IonContent,
  IonPage,
  IonButton,
  IonIcon,
  useIonRouter,
  useIonToast,
} from "@ionic/react";
import {
  motion,
} from "framer-motion";
import {
  checkmarkCircle,
  ellipseOutline,
  leaf,
  trophy,
  analyticsOutline,
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import "./Quiz.css";
import StudentHeader from "../components/StudentHeader";
import StudentSidebar from "../components/StudentSidebar";
import { getUserData } from "../utils/userUtils";
import { useSound } from "../context/SoundContext";
import { triggerConfetti } from "../utils/confettiUtils";
import { progressionService } from "../services/progressionService";
import { learningStatsService } from "../services/learningStatsService";
import { getApiUrl } from "../config/api";
import { useAvatar } from "../context/AvatarContext";
import { getQuestionSprite } from "../utils/avatarUtils";

// IMPORTANT: Read user id directly from localStorage inside async functions to avoid stale closure
function getStoredUser(): { id?: number; name?: string } {
  try {
    const raw =
      localStorage.getItem("userData") || localStorage.getItem("user");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

interface ExpandedQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  correctAnswers?: number[];
  allowMultiple?: boolean;
}

interface TopicBreakdown {
  topicId: number;
  topicName: string;
  points: number;
  maxPoints: number;
  percentage: number;
}

const Quiz: React.FC = () => {
  const { t } = useTranslation();
  const router = useIonRouter();
  const location = useLocation();
  const { playSuccess } = useSound();
  const { currentAvatar } = useAvatar();
  const [presentToast] = useIonToast();

  const handleLogout = () => {
    router.push("/login", "root", "replace");
  };

  const currentUser = getUserData();

  // State
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isAnswered, setIsAnswered] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [animationPoints, setAnimationPoints] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [activeQuestions, setActiveQuestions] = useState<ExpandedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizName, setQuizName] = useState("");

  // Use refs for values needed inside setTimeout callbacks (avoid stale closures)
  const assignmentIdRef = useRef<string | null>(null);
  const quizIdRef = useRef<string | null>(null);
  const quizStartTimeRef = useRef<string>(new Date().toISOString());
  const responseHistoryRef = useRef<any[]>([]);
  const scoreRef = useRef(0);
  const correctCountRef = useRef(0);

  const [topicResults, setTopicResults] = useState<TopicBreakdown[]>([]);
  const [sessionStats, setSessionStats] = useState<{
    accuracy: number;
    timeSpent: number;
  } | null>(null);

  // Sync score ref
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { correctCountRef.current = correctCount; }, [correctCount]);

  // Audio
  const correctAudio = new Audio("/assets/correct-answer.mp3");
  const wrongAudio = new Audio("/assets/wrong-answer.mp3");

  // Fetch Quiz Data
  useEffect(() => {
    const fetchQuiz = async () => {
      const searchParams = new URLSearchParams(location.search);
      const qId = searchParams.get("quizId");
      const aId = searchParams.get("assignmentId");

      assignmentIdRef.current = aId;
      quizIdRef.current = qId;
      quizStartTimeRef.current = new Date().toISOString();

      if (!qId) {
        setLoading(false);
        // Only show error if we are actively on the quiz page and it's missing the ID.
        // During navigation away, location.search changes and this could fire erroneously.
        if (location.pathname.includes("/quiz") && !location.pathname.includes("-menu")) {
          presentToast({
            message: "No se especificó un quiz. Vuelve a intentarlo.",
            duration: 3000,
            color: "danger",
          });
        }
        return;
      }

      try {
        const token =
          localStorage.getItem("authToken") || localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }

        const response = await fetch(getApiUrl(`/api/quizzes/${qId}/full`), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const quiz = data.quiz;
          setQuizName(quiz.quiz_name);

          const transformed: ExpandedQuestion[] = quiz.questions.map(
            (q: any) => {
              const options = [q.option_1, q.option_2];
              if (q.option_3) options.push(q.option_3);
              if (q.option_4) options.push(q.option_4);

              let correctIndices: number[] = [];
              try {
                const parsed = JSON.parse(q.correct_options);
                if (Array.isArray(parsed)) {
                  correctIndices = parsed.map((i: any) => Number(i) - 1);
                }
              } catch (e) {
                console.error("Error parsing correct options", e);
              }

              return {
                id: q.id_question,
                question: q.question_text,
                options,
                correctAnswer: correctIndices[0] ?? 0,
                correctAnswers: correctIndices,
                allowMultiple:
                  q.allow_multiple_selection === 1 ||
                  q.allow_multiple_selection === true,
              };
            }
          );

          if (transformed.length === 0) {
            presentToast({
              message: "Este quiz no tiene preguntas.",
              duration: 2000,
              color: "warning",
            });
          }

          setActiveQuestions(transformed);
        } else {
          presentToast({
            message: "Error cargando el quiz.",
            duration: 2000,
            color: "danger",
          });
        }
      } catch (error) {
        console.error("Error loading quiz:", error);
        presentToast({
          message: "Error de conexión al cargar el quiz.",
          duration: 2000,
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [location.search]);

  const currentQ = activeQuestions[currentQuestion];
  const isMultiple = currentQ?.allowMultiple || false;

  const handleOptionClick = (index: number) => {
    if (isAnswered && !isMultiple) return;

    if (isMultiple) {
      if (isAnswered) return;
      if (selectedAnswers.includes(index)) {
        setSelectedAnswers(selectedAnswers.filter((i) => i !== index));
      } else {
        setSelectedAnswers([...selectedAnswers, index]);
      }
    } else {
      submitSingleAnswer(index);
    }
  };

  const submitSingleAnswer = (index: number) => {
    const endTime = Date.now();
    const timeTaken = (endTime - startTime) / 1000;

    let isCorrect = false;
    if (currentQ.correctAnswers && currentQ.correctAnswers.length > 0) {
      isCorrect = currentQ.correctAnswers.includes(index);
    } else {
      isCorrect = index === currentQ.correctAnswer;
    }

    setSelectedAnswer(index);
    setIsAnswered(true);

    // Record response
    responseHistoryRef.current.push({
      questionId: currentQ.id,
      selectedOptions: JSON.stringify([index + 1]),
      timeTaken,
      isCorrect,
    });

    processResult(isCorrect, timeTaken);
  };

  const submitMultipleAnswer = () => {
    if (selectedAnswers.length === 0) return;

    const endTime = Date.now();
    const timeTaken = (endTime - startTime) / 1000;
    const correctSet = currentQ.correctAnswers || [currentQ.correctAnswer];

    const isCorrect =
      selectedAnswers.length === correctSet.length &&
      selectedAnswers.every((a) => correctSet.includes(a));

    setIsAnswered(true);

    // Record response
    responseHistoryRef.current.push({
      questionId: currentQ.id,
      selectedOptions: JSON.stringify(selectedAnswers.map((a) => a + 1)),
      timeTaken,
      isCorrect,
    });

    processResult(isCorrect, timeTaken);
  };

  const processResult = (isCorrect: boolean, timeTaken: number) => {
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);

      let pointsEarned = 0;
      if (timeTaken < 5) pointsEarned = 150;
      else if (timeTaken < 10) pointsEarned = 125;
      else if (timeTaken < 15) pointsEarned = 110;
      else pointsEarned = 100;

      setAnimationPoints(pointsEarned);
      setShowPointsAnimation(true);

      correctAudio.play().catch(() => {});

      const startScore = scoreRef.current;
      const endScore = startScore + pointsEarned;
      animateScore(startScore, endScore);
    } else {
      wrongAudio.play().catch(() => {});
      setScore((prev) => Math.max(0, prev - 25));
    }

    setTimeout(() => {
      if (currentQuestion < activeQuestions.length - 1) {
        setCurrentQuestion((prev) => prev + 1);
        setSelectedAnswer(null);
        setSelectedAnswers([]);
        setIsAnswered(false);
        setStartTime(Date.now());
        setShowPointsAnimation(false);
      } else {
        finishQuiz();
      }
    }, 2000);
  };

  const animateScore = (start: number, end: number) => {
    const duration = 1000;
    const startTimeStamp = performance.now();

    const update = (currentTime: number) => {
      const elapsed = currentTime - startTimeStamp;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(start + (end - start) * ease);
      setScore(current);
      if (progress < 1) requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
  };

  const finishQuiz = () => {
    // Capture snapshot of values at finish time (avoid stale closure issues)
    const finalQuizId = quizIdRef.current;
    const finalAssignmentId = assignmentIdRef.current;
    const finalStartedAt = quizStartTimeRef.current;
    const finalResponses = [...responseHistoryRef.current];
    const currentScore = scoreRef.current;
    const currentCorrectCount = correctCountRef.current;
    const totalQuestions = activeQuestions.length;

    const totalTime = Math.round(
      (Date.now() - new Date(finalStartedAt).getTime()) / 1000
    );
    const accuracy = Math.round((currentCorrectCount / totalQuestions) * 100);
    setSessionStats({ accuracy, timeSpent: totalTime });

    setTimeout(async () => {
      // Add XP
      if (currentScore > 0) progressionService.addXp(currentScore);

      // Save local stats
      learningStatsService.saveResult({
        subject: "General",
        score: currentScore,
        correctCount: currentCorrectCount,
        totalQuestions,
        timestamp: Date.now(),
      });

      // Submit to backend — always, regardless of assignment
      if (finalQuizId) {
        try {
          const token =
            localStorage.getItem("authToken") || localStorage.getItem("token");
          const user = getStoredUser();

          if (token && user?.id) {
            const body = {
              studentId: user.id,
              quizId: Number(finalQuizId),
              assignmentId: finalAssignmentId
                ? Number(finalAssignmentId)
                : undefined,
              startedAt: finalStartedAt,
              finishedAt: new Date().toISOString(),
              focusLostCount: 0,
              responses: finalResponses,
            };

            const response = await fetch(getApiUrl("/api/quizzes/submit"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(body),
            });

            if (response.ok) {
              const result = await response.json();
              if (result.topicBreakdown && result.topicBreakdown.length > 0) {
                setTopicResults(result.topicBreakdown);
              }
            } else {
              const err = await response.text();
              console.error("[Quiz] Submit failed:", err);
            }
          } else {
            console.warn("[Quiz] No user id found in localStorage — skipping submission");
          }
        } catch (e) {
          console.error("[Quiz] Failed to submit quiz results:", e);
        }
      }

      setShowResults(true);
      triggerConfetti();
    }, 1000);
  };

  const getQuestionText = () => {
    if (!currentQ) return "";
    return currentQ.question.replace("{name}", currentUser?.name || "Estudiante");
  };

  const getButtonClass = (index: number) => {
    const base = "quiz-answer-btn-new";
    const isSelected = isMultiple
      ? selectedAnswers.includes(index)
      : selectedAnswer === index;

    if (isAnswered) {
      const correctSet = currentQ.correctAnswers || [currentQ.correctAnswer];
      const isCorrect = correctSet.includes(index);
      if (isCorrect) return `${base} status-correct`;
      if (isSelected && !isCorrect) return `${base} status-incorrect`;
      return base;
    }

    if (isSelected) return `${base} selected`;
    return base;
  };

  const handleBackToMenu = () => {
    router.push("/quiz-menu", "back", "pop");
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 80) return "var(--ion-color-success, #4CAF50)";
    if (percentage >= 60) return "var(--ion-color-warning, #FFC107)";
    return "var(--ion-color-danger, #F44336)";
  };

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <IonPage className="quiz-new-layout">
        <StudentHeader pageTitle="Cargando..." showBackButton onBack={handleBackToMenu} />
        <IonContent className="quiz-content-redesign">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              gap: "20px",
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                border: "5px solid var(--ion-color-primary)",
                borderTopColor: "transparent",
              }}
            />
            <p style={{ color: "var(--ion-text-color)", fontSize: "1.1rem", fontWeight: 600 }}>
              Cargando quiz...
            </p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── NO QUESTIONS ───────────────────────────────────────────────────────────
  if (!currentQ && !showResults) {
    return (
      <IonPage className="quiz-new-layout">
        <StudentHeader pageTitle="Quiz" showBackButton onBack={handleBackToMenu} />
        <IonContent>
          <div style={{ padding: "40px", textAlign: "center" }}>
            <h3>Quiz no encontrado o sin preguntas.</h3>
            <IonButton onClick={handleBackToMenu}>Volver</IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────────
  if (showResults) {
    return (
      <IonPage className="quiz-new-layout">
        <StudentHeader
          pageTitle="Resultados"
          showBackButton
          onBack={handleBackToMenu}
        />
        <IonContent className="quiz-content-redesign">
          <div className="quiz-scaler-wrapper">
            <div className="quiz-results-container">
              <motion.div
                className="results-victory-card"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, type: "spring" }}
              >
                <motion.div
                  className="results-icon-wrapper"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  <IonIcon icon={trophy} />
                </motion.div>

                <h1 className="results-score-title">¡Felicidades!</h1>

                <div className="results-stats-grid">
                  <div className="stat-item">
                    <span className="stat-value">{score}</span>
                    <span className="stat-label">Puntos</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">
                      {correctCount}/{activeQuestions.length}
                    </span>
                    <span className="stat-label">Aciertos</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">
                      {sessionStats?.timeSpent ?? 0}s
                    </span>
                    <span className="stat-label">Tiempo</span>
                  </div>
                </div>

                {topicResults.length > 0 && (
                  <>
                    <div className="results-section-title">
                      <IonIcon icon={analyticsOutline} />
                      <span>Desempeño por Tema</span>
                    </div>

                    <div className="topic-breakdown-list">
                      {topicResults.map((topic, idx) => (
                        <motion.div
                          key={topic.topicId}
                          className="topic-result-card"
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.5 + idx * 0.1 }}
                        >
                          <div className="topic-header">
                            <span className="topic-name">{topic.topicName}</span>
                            <span
                              className="topic-percentage"
                              style={{
                                color: getPerformanceColor(topic.percentage),
                              }}
                            >
                              {Math.round(topic.percentage)}%
                            </span>
                          </div>
                          <div className="topic-progress-track">
                            <motion.div
                              className="topic-progress-fill"
                              style={{
                                backgroundColor: getPerformanceColor(
                                  topic.percentage
                                ),
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${topic.percentage}%` }}
                              transition={{ duration: 1.5, delay: 0.8 }}
                            />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}

                <IonButton
                  className="results-continue-btn"
                  expand="block"
                  color="primary"
                  onClick={handleBackToMenu}
                >
                  Continuar
                </IonButton>
              </motion.div>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── QUIZ IN PROGRESS ───────────────────────────────────────────────────────
  return (
    <IonPage className="quiz-new-layout">
      {showPointsAnimation && (
        <div className="quiz-floating-points">+{animationPoints}</div>
      )}

      <StudentHeader
        pageTitle={quizName || "Quiz"}
        showBackButton
        onBack={handleBackToMenu}
        notchContent={
          <div
            className="sh-subject-display"
            style={{ width: "auto", padding: "0 20px", cursor: "default" }}
          >
            <span
              className="quiz-score-val"
              style={{ fontSize: "1.5rem", fontWeight: 800, color: "white" }}
            >
              {score}
            </span>
          </div>
        }
      />

      <StudentSidebar onLogout={handleLogout} />

      <IonContent fullscreen className="quiz-content-redesign">
        <div className="quiz-scaler-wrapper">
          <div className="quiz-main-layout">
            <div className="quiz-visual-block">
              <div className="quiz-mascot-layer">
                <img
                  src={getQuestionSprite(currentAvatar)}
                  alt="Mascot"
                  className="quiz-mascot-img-large"
                />
              </div>
              <div className="quiz-card-container">
                <div className="quiz-name-pill">
                  <span>Aren</span>
                </div>
                <div className="quiz-card-text">{getQuestionText()}</div>
              </div>
            </div>

            <div className="quiz-controls-row">
              <div className="quiz-type-badge">
                {isMultiple ? t("Respuesta multiple") : t("Respuesta única")}
              </div>
              {isMultiple && (
                <div className="quiz-ok-btn-visible" onClick={submitMultipleAnswer}>
                  Ok
                </div>
              )}
            </div>

            <div className="quiz-separator-floral">
              <div className="separator-line"></div>
              <div className="separator-icon">
                <IonIcon icon={leaf} /> <span>❧</span>
              </div>
              <div className="separator-line"></div>
            </div>

            <div className="quiz-answers-container-box">
              {currentQ.options.map((option, idx) => (
                <div
                  key={idx}
                  className={getButtonClass(idx)}
                  onClick={() => handleOptionClick(idx)}
                >
                  <div className="answer-check-icon">
                    {(
                      isMultiple
                        ? selectedAnswers.includes(idx)
                        : selectedAnswer === idx
                    ) ? (
                      <IonIcon icon={checkmarkCircle} />
                    ) : (
                      <IonIcon icon={ellipseOutline} />
                    )}
                  </div>
                  <span className="answer-text-content">{option}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="quiz-footer-progress">
          <div
            className="quiz-progress-fill"
            style={{
              width: `${
                ((currentQuestion + 1) / activeQuestions.length) * 100
              }%`,
            }}
          ></div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Quiz;
