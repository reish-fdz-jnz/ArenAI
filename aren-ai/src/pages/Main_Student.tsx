import React, { useState, useEffect, useRef } from "react";
import { useAvatar } from "../context/AvatarContext";
import {
  IonContent,
  IonPage,
  IonIcon,
  IonMenuButton,
  IonText,
  useIonRouter,
  IonSkeletonText,
} from "@ionic/react";
import {
  calculator,
  flask,
  globe,
  language,
  book,
  trophyOutline,
  chatbubbleEllipsesOutline,
  settingsOutline,
  homeOutline,
  americanFootballOutline,
  peopleOutline,
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import "./Main_Student.css";
import StudentMenu from "../components/StudentMenu";
import StudentHeader from "../components/StudentHeader";
import AnimatedMascot from "../components/AnimatedMascot";
import { CalendarSelector } from "../components/CalendarSelector";
import { studentService } from "../services/studentService";
import { TopicProgress, WeekData } from "../types/student";
import { getSubjectKey } from "../utils/subjectUtils";
import PageTransition from "../components/PageTransition";
import { getApiUrl } from "../config/api";
import { socketService } from "../services/socket";

// ============================================================================
// COMPONENT
// ============================================================================

const Main_Student: React.FC = () => {
  const router = useIonRouter();
  const { t } = useTranslation();
  const { getAvatarAssets } = useAvatar();
  const avatarAssets = getAvatarAssets();

  // State
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [overallPerformance, setOverallPerformance] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState(() => {
    return localStorage.getItem("selectedSubject") || "Math";
  });
  const [topics, setTopics] = useState<TopicProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New State for Redesign
  const [viewMode, setViewMode] = useState<"insights" | "que">("insights");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // AI Insights State
  const [studentInsights, setStudentInsights] = useState<{
    summary: string;
    issues: string[];
  } | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Typing animation state
  const [displayedSummary, setDisplayedSummary] = useState("");
  const [displayedIssues, setDisplayedIssues] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const issueTimeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Persist selectedSubject
  useEffect(() => {
    localStorage.setItem("selectedSubject", selectedSubject);
  }, [selectedSubject]);

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [fetchedWeeks, fetchedStats] = await Promise.all([
          studentService.getWeeks(),
          studentService.getStudentStats(),
        ]);
        setWeeks(fetchedWeeks);
        // Stats can be used if we want global performance
      } catch (error) {
        console.error("Failed to fetch initial data", error);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  // Update topics and overall performance when subject changes
  useEffect(() => {
    const fetchSubjectData = async () => {
      // Don't set full loading here to avoid screen flickering,
      // maybe just a small loading indicator or skeleton on the list if needed.
      // For now we'll do a quick fetch.
      const subjectData =
        await studentService.getSubjectDetails(selectedSubject);
      setTopics(subjectData.topics);

      const newPerformance = calculateOverallPerformance(subjectData.topics);
      setOverallPerformance(newPerformance);
    };

    fetchSubjectData();
  }, [selectedSubject]);

  // Helper Functions
  const calculateOverallPerformance = (currentTopics: TopicProgress[]) => {
    if (!currentTopics || currentTopics.length === 0) return 0;
    const sum = currentTopics.reduce(
      (total, topic) => total + topic.percentage,
      0,
    );
    return Math.round(sum / currentTopics.length);
  };

  // Helper for color interpolation (Red to Teal)
  const getColorForPercentage = (percentage: number) => {
    const p = Math.max(0, Math.min(100, percentage)) / 100;

    // Interpolate between Red (#FF5252) and Teal (#78B8B0)
    const startColor = { r: 255, g: 82, b: 82 }; // Red
    const endColor = { r: 120, g: 184, b: 176 }; // #78B8B0

    const r = Math.round(startColor.r + (endColor.r - startColor.r) * p);
    const g = Math.round(startColor.g + (endColor.g - startColor.g) * p);
    const b = Math.round(startColor.b + (endColor.b - startColor.b) * p);

    return `rgb(${r}, ${g}, ${b})`;
  };

  // Typing animation effect for summary + issues
  const startTypingAnimation = (
    text: string,
    issues: string[],
    speed: number = 20,
  ) => {
    // Clear any existing timeouts
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }
    issueTimeoutRefs.current.forEach((t) => clearTimeout(t));
    issueTimeoutRefs.current = [];

    setDisplayedSummary("");
    setDisplayedIssues([]);
    setIsTyping(true);
    let charIndex = 0;

    typingIntervalRef.current = setInterval(() => {
      if (charIndex < text.length) {
        setDisplayedSummary(text.substring(0, charIndex + 1));
        charIndex++;
      } else {
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
        }
        setIsTyping(false);

        // After summary is done, animate issues one by one
        issues.forEach((issue, idx) => {
          const timeout = setTimeout(
            () => {
              setDisplayedIssues((prev) => [...prev, issue]);
            },
            300 * (idx + 1),
          ); // 300ms delay between each issue
          issueTimeoutRefs.current.push(timeout);
        });
      }
    }, speed);
  };

  // Cleanup typing interval and issue timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
      issueTimeoutRefs.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Fetch student's AI insights
  const fetchStudentInsights = async (animate: boolean = false) => {
    setInsightsLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const userStr = localStorage.getItem("userData");
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?.id;

      if (userId && token) {
        const response = await fetch(
          getApiUrl(`/ai/student-insights?userId=${userId}&classId=1`),
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          console.log("[Debug] Student insights response:", data);

          if (data.insights && data.insights.length > 0) {
            const latestInsight = data.insights[0];
            const newInsights = {
              summary: latestInsight.summary || "",
              issues: latestInsight.weaknesses || [],
            };
            setStudentInsights(newInsights);

            // Trigger typing animation if requested (new summary)
            if (animate && newInsights.summary) {
              startTypingAnimation(newInsights.summary, newInsights.issues);
            } else {
              setDisplayedSummary(newInsights.summary);
              setDisplayedIssues(newInsights.issues);
            }
          } else {
            setStudentInsights(null);
            setDisplayedSummary("");
            setDisplayedIssues([]);
          }
        } else {
          setStudentInsights(null);
          setDisplayedSummary("");
        }
      }
    } catch (err) {
      console.error("Error fetching student insights:", err);
      setStudentInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  };

  // Initial fetch on mount/subject change
  useEffect(() => {
    fetchStudentInsights(false);
  }, [selectedSubject]);

  // WebSocket listener for real-time summary updates
  useEffect(() => {
    socketService.connect();

    const handleInsightUpdate = (data: {
      timestamp: string;
      message: string;
      data?: any;
    }) => {
      console.log("[Main_Student] Insight update received:", data);

      // Check if this is a summary saved for the current user
      if (data.data?.status === "summary_saved") {
        const userStr = localStorage.getItem("userData");
        const user = userStr ? JSON.parse(userStr) : null;
        const currentUserId = user?.id;

        if (data.data.userId === currentUserId) {
          console.log(
            "[Main_Student] New summary for current user - refetching with animation",
          );
          fetchStudentInsights(true); // Refetch with animation
        }
      }
    };

    socketService.socket?.on("insight_update", handleInsightUpdate);

    return () => {
      socketService.socket?.off("insight_update", handleInsightUpdate);
    };
  }, []);

  const questionKeys = ["q1", "q2", "q3", "q4", "q5"];
  const currentQuestion = t(
    `mainStudent.studentQuestions.${questionKeys[currentQuestionIndex]}`,
  );

  // Handlers
  const handleNextQuestion = () => {
    setCurrentQuestionIndex((prev) => (prev + 1) % 5);
  };

  const handlePrevQuestion = () => {
    setCurrentQuestionIndex((prev) => (prev - 1 + 5) % 5);
  };

  const [selectedDate, setSelectedDate] = useState(new Date());

  // Available subjects
  const availableSubjects = ["Math", "Science", "Social Studies", "Spanish"];

  // Handlers
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    console.log("Selected date:", date);
  };

  const handleCalendarSubjectSelect = (subject: string, date: Date) => {
    setSelectedSubject(subject);
    setSelectedDate(date);
  };

  const navigateTo = (path: string) => {
    router.push(path, "forward", "push");
  };

  return (
    <IonPage className="main-student-page">
      {/* Replaced Header with Component */}
      <StudentHeader
        showSubject={true}
        selectedSubject={selectedSubject}
        onSubjectChange={setSelectedSubject}
      />

      <IonContent fullscreen class="student-page-content">
        <PageTransition variant="fade">
          <div className="ms-container">
            {/* Skeleton Loader for Main Content */}
            {isLoading ? (
              <div style={{ padding: "20px" }}>
                <IonSkeletonText
                  animated
                  style={{
                    width: "100%",
                    height: "50px",
                    borderRadius: "12px",
                    marginBottom: "20px",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "30px",
                  }}
                >
                  <IonSkeletonText
                    animated
                    style={{
                      width: "40%",
                      height: "30px",
                      borderRadius: "20px",
                    }}
                  />
                  <IonSkeletonText
                    animated
                    style={{
                      width: "70px",
                      height: "70px",
                      borderRadius: "50%",
                    }}
                  />
                </div>
                <IonSkeletonText
                  animated
                  style={{
                    width: "100%",
                    height: "120px",
                    borderRadius: "15px",
                  }}
                />
              </div>
            ) : (
              <>
                {/* Calendar Selector — now wired to subject selection */}
                <div className="ms-week-selector">
                  <CalendarSelector
                    onDateSelect={handleDateSelect}
                    onSubjectSelect={handleCalendarSubjectSelect}
                    title={t("Clase prototipo") || "Class Schedule"}
                    subjects={availableSubjects}
                    selectedSubject={selectedSubject}
                  />
                </div>

                {/* Stats Row: Subject + Grade */}
                <div className="ms-stats-row">
                  <div className="ms-your-math-pill">
                    {t("mainStudent.yourSubject", {
                      subject: t(getSubjectKey(selectedSubject)),
                    })}
                  </div>
                  <div
                    className="ms-progress-circle"
                    style={{
                      border: `6px solid ${getColorForPercentage(
                        overallPerformance,
                      )}`,
                      boxShadow: `inset 0 0 0 3px white`, // White inner outline
                      color: "white",
                      width: "70px",
                      height: "70px",
                      borderRadius: "50%",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      fontWeight: "bold",
                      fontSize: "18px",
                      backgroundColor: "var(--ion-color-secondary)",
                    }}
                  >
                    {overallPerformance}%
                  </div>
                </div>

                {/* Topics Grid (Swipeable) */}
                <div className="ms-topics-scroll-container">
                  <div className="ms-topics-track">
                    {topics.map((topic, index) => (
                      <div
                        key={index}
                        className="ms-topic-btn"
                        onClick={() =>
                          navigateTo(`/subject/${selectedSubject}`)
                        }
                      >
                        <div className="ms-topic-fill-box">
                          <div
                            className="ms-topic-fill"
                            style={{
                              height: `${topic.percentage}%`,
                              backgroundColor:
                                topic.percentage < 60 ? "#FFC107" : "#78B8B0",
                            }}
                          ></div>
                          <div className="ms-topic-icon">
                            {topic.icon || "•"}
                          </div>
                        </div>
                        <span className="ms-topic-label">
                          {t(topic.nameKey)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Section (Switch + Content) */}
                <div className="ms-bottom-section">
                  <div className="ms-switch-container">
                    <div
                      className="ms-switch-bg"
                      style={{
                        transform:
                          viewMode === "insights"
                            ? "translateX(0)"
                            : "translateX(100%)",
                      }}
                    ></div>
                    <div
                      className={`ms-switch-option ${
                        viewMode === "insights" ? "active" : ""
                      }`}
                      onClick={() => setViewMode("insights")}
                    >
                      {t("mainStudent.myProgress", "My Progress")}
                    </div>
                    <div
                      className={`ms-switch-option ${
                        viewMode === "que" ? "active" : ""
                      }`}
                      onClick={() => setViewMode("que")}
                    >
                      {t("mainStudent.questions")}
                    </div>
                  </div>

                  <div className="ms-info-display">
                    {viewMode === "insights" ? (
                      <>
                        <div
                          className="ms-info-content"
                          style={{
                            fontSize: "13px",
                            lineHeight: "1.6",
                            textAlign: "center",
                          }}
                        >
                          {insightsLoading ? (
                            <p>{t("common.loading", "Loading...")}</p>
                          ) : studentInsights &&
                            (studentInsights.summary ||
                              studentInsights.issues.length > 0) ? (
                            <>
                              {(displayedSummary || isTyping) && (
                                <p style={{ marginBottom: "12px" }}>
                                  {displayedSummary}
                                  {isTyping && (
                                    <span
                                      style={{
                                        animation: "blink 1s step-end infinite",
                                      }}
                                    >
                                      |
                                    </span>
                                  )}
                                </p>
                              )}
                              {displayedIssues.length > 0 && (
                                <ul
                                  style={{
                                    margin: 0,
                                    paddingLeft: "16px",
                                    listStyleType: "disc",
                                  }}
                                >
                                  {displayedIssues.map((issue, idx) => (
                                    <li
                                      key={idx}
                                      style={{
                                        marginBottom: "4px",
                                        animation: "fadeIn 0.3s ease-in",
                                      }}
                                    >
                                      {issue}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </>
                          ) : (
                            <p style={{ fontStyle: "italic", opacity: 0.8 }}>
                              {t(
                                "mainStudent.nothingToSummarize",
                                "Start chatting with the AI tutor to get personalized insights!",
                              )}
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="ms-info-title">
                          {t("mainStudent.popularQuestions")}
                        </div>
                        <div className="ms-question-carousel">
                          <div
                            className="ms-carousel-arrow"
                            onClick={handlePrevQuestion}
                          >
                            &lt;
                          </div>
                          <div
                            className="ms-info-content"
                            style={{ padding: "0 10px" }}
                          >
                            {currentQuestion}
                          </div>
                          <div
                            className="ms-carousel-arrow"
                            onClick={handleNextQuestion}
                          >
                            &gt;
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </PageTransition>
      </IonContent>

      {/* Bottom Navigation */}
      <div className="student-bottom-nav">
        <div
          className="student-nav-btn"
          onClick={() => navigateTo("/chat-menu")}
        >
          <IonIcon icon={peopleOutline} />
        </div>
        <div className="student-nav-btn" onClick={() => navigateTo("/quiz")}>
          <IonIcon icon={trophyOutline} />
        </div>

        <div className="student-mascot-container">
          <AnimatedMascot
            openSrc={avatarAssets.open}
            closedSrc={avatarAssets.closed}
            winkSrc={avatarAssets.wink}
            className="student-mascot-image"
            onClick={() => navigateTo("/chat")}
          />
        </div>

        <div
          className="student-nav-btn"
          onClick={() => navigateTo("/battlelobby")}
        >
          <IonIcon icon={americanFootballOutline} />
        </div>
        <div
          className="student-nav-btn"
          onClick={() => navigateTo("/settings")}
        >
          <IonIcon icon={settingsOutline} />
        </div>
      </div>
    </IonPage>
  );
};

export default Main_Student;
