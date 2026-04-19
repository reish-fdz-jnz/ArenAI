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
  useIonViewWillEnter,
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
  schoolOutline,
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import "./Main_Student.css";
import { 
  StudentMenu, 
  StudentHeader, 
  AnimatedMascot, 
  CalendarSelector, 
  TopicBubble, 
  PageTransition, 
  DailyScheduleView,
  DailySession
} from "../components";
import { studentService } from "../services/studentService";
import { TopicProgress, WeekData } from "../types/student";
import { getSubjectKey } from "../utils/subjectUtils";
import { getApiUrl } from "../config/api";
import { socketService } from "../services/socket";
import { useAnimatedScore } from "../hooks/useAnimatedScore";

const SUBJECT_MAP: Record<string, number> = {
  Math: 1,
  Science: 2,
  "Social Studies": 3,
  Spanish: 4,
};
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
  const [overallPerformance, setOverallPerformance] = useState<number | null>(null);
  const animatedPerformance = useAnimatedScore(overallPerformance);
  const [selectedSubject, setSelectedSubject] = useState(() => {
    return localStorage.getItem("selectedSubject") || "Math";
  });
  const [topics, setTopics] = useState<TopicProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedInitialData = useRef(false);

  // New State for Redesign
  const [viewMode, setViewMode] = useState<"insights" | "que">("insights");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Session State
  const [sessionMarkers, setSessionMarkers] = useState<Record<string, number>>({});
  const [dailySessions, setDailySessions] = useState<DailySession[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [showScheduleView, setShowScheduleView] = useState(false);
  const [isManualDateSelection, setIsManualDateSelection] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());


  // AI Insights State
  const [studentInsights, setStudentInsights] = useState<{
    summary: string;
    issues: string[];
  } | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Typing animation state
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [displayedSummary, setDisplayedSummary] = useState<string>("");
  const [displayedIssues, setDisplayedIssues] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const issueTimeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Persist selectedSubject
  useEffect(() => {
    localStorage.setItem("selectedSubject", selectedSubject);
  }, [selectedSubject]);

  // Fetch Session History
  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const offset = new Date().getTimezoneOffset();
      const res = await fetch(getApiUrl(`api/student-sessions/history?timezoneOffset=${offset}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && typeof data === 'object') {
        setSessionMarkers(data);
      }
    } catch (err) {
      console.error("Error fetching session history:", err);
    }
  };

  const loadDashboardData = async () => {
    try {
      const [fetchedWeeks, fetchedStats] = await Promise.all([
        studentService.getWeeks(),
        studentService.getStudentStats(),
      ]);
      setWeeks(fetchedWeeks);
      // Wait to set stats if we end up adding them to state, right now overallPerformance handles score, but stats handles rank/wins/etc. if mapped 
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    }
    fetchHistory();
    fetchSessionState();
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useIonViewWillEnter(() => {
    loadDashboardData();
  });

  // Fetch Session State
  const fetchSessionState = async () => {
    // Only show skeleton if we have no data yet and it's the first load
    if (topics.length === 0 && !hasLoadedInitialData.current) {
      setIsLoading(true);
    }
    try {
      const token = localStorage.getItem('authToken');
      
      let activeSessionData: any = null;
      if (!isManualDateSelection) {
        const activeRes = await fetch(getApiUrl(`api/student-sessions/active`), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (activeRes.ok) {
          const result = await activeRes.json();
          activeSessionData = result.data;
          
          if (activeSessionData && activeSessionData.id_class) {
            setActiveSession(activeSessionData);
            setDailySessions([activeSessionData]);
            if (activeSessionData.topics) {
                const formattedTopics: TopicProgress[] = activeSessionData.topics.map((t: any) => {
                    let score = (t.score !== undefined && t.score !== null) ? Number(t.score) : null;
                    // Auto-scale fractional scores (0.35 -> 35)
                    if (score !== null && score > 0 && score <= 1) {
                        score = score * 100;
                    }
                    return {
                        id: t.id_topic,
                        name: t.name_topic || t.name || "",
                        nameKey: t.name_topic || t.name || "",
                        percentage: score,
                        icon: "🎓"
                    };
                });
                // Only override standard topics if we have them
                setTopics(formattedTopics);
                setOverallPerformance(Number(activeSessionData.student_score_average) || 0);

                const summary = activeSessionData.student_ai_summary || activeSessionData.class_ai_summary || "Class is active. Monitoring your progress...";
                setStudentInsights({ summary, issues: [] });
                setDisplayedSummary(summary);
            }
            setIsLoading(false);
            return; // Skip normal fetching if active session is present!
          } else {
            // Explicitly clear active session if API confirms NO session is running
            setActiveSession(null);
          }
        } else {
          setActiveSession(null);
        }
      }

      // Check daily sessions fallback
      const dateStr = [
        selectedDate.getFullYear(),
        String(selectedDate.getMonth() + 1).padStart(2, '0'),
        String(selectedDate.getDate()).padStart(2, '0')
      ].join('-');

      const offset = new Date().getTimezoneOffset();
      const sessionRes = await fetch(getApiUrl(`api/student-sessions/by-date?date=${dateStr}&timezoneOffset=${offset}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const sessionsObj = await sessionRes.json();
      const sessions: DailySession[] = Array.isArray(sessionsObj) ? sessionsObj : (sessionsObj && sessionsObj.id_class ? [sessionsObj] : []);
      
      setDailySessions(prev => {
        const merged = [...sessions];
        if (activeSessionData && !merged.some(s => s.id_class === activeSessionData.id_class)) {
            merged.push(activeSessionData);
        }
        return merged;
      });

      if (isManualDateSelection) {
        setShowScheduleView(true);
      }

      // Fallback: Fetch regular subject data if NOT looking at a specific session
      if (!activeSessionData) {
          const sId = SUBJECT_MAP[selectedSubject] || 1;
          const subjectData = await studentService.getSubjectDetails(sId, selectedSubject);
          setTopics(subjectData.topics);
          setOverallPerformance(subjectData.overallAverage);
      }

    } catch (err) {
      console.error("Error fetching session state:", err);
    } finally {
      setIsLoading(false);
      hasLoadedInitialData.current = true;
    }
  };

  useEffect(() => {
    fetchSessionState();
  }, [selectedDate, selectedSubject]);

  const handleReturnToToday = () => {
    setIsManualDateSelection(false);
    setSelectedDate(new Date());
    // fetchSessionState will be triggered by the useEffect on [selectedDate]
  };

  // Helper Functions
  const calculateOverallPerformance = (currentTopics: TopicProgress[]) => {
    if (!currentTopics || currentTopics.length === 0) return 0;
    const sum = currentTopics.reduce(
      (total, topic) => total + (topic.percentage || 0),
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

    const handleClassStarted = (data: any) => {
      console.log("[Main_Student] Class started notification received:", data);
      // Automatically pull the student into the live class even if they were reviewing history
      setIsManualDateSelection(false);
      setSelectedDate(new Date());
      fetchSessionState();
    };

    const handleClassFinished = (data: any) => {
      console.log("[Main_Student] Class finished notification received:", data);
      // Reset live class state without a page reload
      setActiveSession(null);
      setOverallPerformance(0);
      // Optional: re-fetch to see if there's another class or to update history list
      fetchSessionState();
    };

    const handleTopicUpdate = (data: { topicId: number; score: number }) => {
      console.log("[Main_Student] Topic update received:", data);
      setTopics(prev => prev.map(t => t.id === data.topicId ? { ...t, percentage: data.score } : t));
    };

    const handleScoreUpdate = (data: { overallAverage: number }) => {
      console.log("[Main_Student] Overall score update received:", data);
      setOverallPerformance(data.overallAverage);
    };

    const unregisterResync = socketService.onResync(() => {
      console.log("[Main_Student] Socket recovered, re-fetching dashboard state...");
      loadDashboardData();
    });

    socketService.socket?.on("insight_update", handleInsightUpdate);
    socketService.socket?.on("class_started", handleClassStarted);
    socketService.socket?.on("class_finished", handleClassFinished);
    socketService.socket?.on("student_topic_update", handleTopicUpdate);
    socketService.socket?.on("student_score_update", handleScoreUpdate);

    return () => {
      unregisterResync();
      socketService.socket?.off("insight_update", handleInsightUpdate);
      socketService.socket?.off("class_started", handleClassStarted);
      socketService.socket?.off("class_finished", handleClassFinished);
      socketService.socket?.off("student_topic_update", handleTopicUpdate);
      socketService.socket?.off("student_score_update", handleScoreUpdate);
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



  // Available subjects
  const availableSubjects = ["Math", "Science", "Social Studies", "Spanish"];

  // Handlers
  const handleDateSelect = (date: Date) => {
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && 
                    date.getMonth() === today.getMonth() && 
                    date.getFullYear() === today.getFullYear();

    setIsManualDateSelection(!isToday);
    setSelectedDate(date);
    console.log("Selected date:", date, "isToday:", isToday);
  };

  const handleCalendarSubjectSelect = (subject: string, date: Date) => {
    setIsManualDateSelection(false);
    setSelectedSubject(subject);
    setSelectedDate(date);
    setActiveSession(null);
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
                    title={activeSession ? activeSession.name_session : t("mainStudent.calendar")}
                    subjects={availableSubjects}
                    selectedSubject={selectedSubject}
                    sessionMarkers={sessionMarkers}
                  />
                  {isManualDateSelection && (
                    <div 
                      className="ms-return-today-pill"
                      onClick={handleReturnToToday}
                    >
                      <IonIcon icon={homeOutline} />
                      <span>{t('common.returnToToday')}</span>
                    </div>
                  )}
                </div>

                {activeSession ? (
                  <>
                    {/* Stats Row: Subject + Grade */}
                    <div className="ms-stats-row">
                      <div className="ms-your-math-pill" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FF5252', animation: 'blink 1s step-end infinite' }}></div>
                        <span>LIVE: {activeSession.name_session}</span>
                      </div>
                      <div
                        className="ms-progress-circle"
                        style={{
                          border: (animatedPerformance !== null && animatedPerformance > 0)
                            ? `6px solid ${getColorForPercentage(animatedPerformance)}`
                            : `6px solid rgba(255, 255, 255, 0.2)`,
                          boxShadow: `inset 0 0 0 3px white`, 
                          color: "white",
                          width: "70px",
                          height: "70px",
                          borderRadius: "50%",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          fontWeight: "bold",
                          fontSize: (animatedPerformance !== null && animatedPerformance > 0) ? "18px" : "28px",
                          backgroundColor: (animatedPerformance !== null && animatedPerformance > 0)
                            ? "var(--ion-color-secondary)"
                            : "rgba(255, 255, 255, 0.1)",
                          backdropFilter: "blur(10px)",
                          WebkitBackdropFilter: "blur(10px)",
                          transition: "border-color 0.5s ease"
                        }}
                      >
                        {animatedPerformance !== null ? `${Math.round(animatedPerformance)}%` : "😊"}
                      </div>
                    </div>

                    {/* Topics Grid (Swipeable) */}
                    <div className="ms-topics-scroll-container">
                      <div className="ms-topics-track">
                        {topics.map((topic, index) => (
                          <TopicBubble 
                            key={`${index}-${topic.id}`}
                            topic={topic}
                            index={index}
                            getColorForPercentage={getColorForPercentage}
                            expandedTopic={expandedTopic}
                            setExpandedTopic={setExpandedTopic}
                            navigateTo={navigateTo}
                            selectedSubject={selectedSubject}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="ms-empty-session" style={{
                    textAlign: 'center',
                    margin: '40px 20px',
                    color: 'rgba(255, 255, 255, 0.9)',
                    padding: '40px 20px',
                    borderRadius: '24px',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <IonIcon
                      icon={schoolOutline}
                      style={{
                        fontSize: '64px',
                        marginBottom: '20px',
                        color: 'var(--ion-color-secondary)',
                        opacity: 0.8
                      }}
                    />
                    <h3 style={{
                      margin: '0 0 12px 0',
                      fontSize: '22px',
                      fontWeight: '700',
                      letterSpacing: '-0.5px'
                    }}>
                      {t("mainStudent.noActiveClassTitle")}
                    </h3>
                    <p style={{
                      margin: 0,
                      fontSize: '16px',
                      lineHeight: '1.6',
                      opacity: 0.7,
                      maxWidth: '280px'
                    }}>
                      {t("mainStudent.noActiveClassDesc")}
                    </p>
                  </div>
                )}

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

      {/* Timeline Overlay Popup */}
      {showScheduleView && (
        <div className="ms-timeline-overlay" onClick={() => setShowScheduleView(false)}>
          <div className="ms-timeline-popup" onClick={(e) => e.stopPropagation()}>
            <div className="ms-popup-header">
              <span className="ms-popup-title">Resumen Diario</span>
              <button className="ms-popup-close" onClick={() => setShowScheduleView(false)}>Cerrar</button>
            </div>
            <div className="ms-popup-body">
              <DailyScheduleView 
                  date={selectedDate}
                  sessions={dailySessions}
                  onSessionSelect={(session) => {
                      setActiveSession(session);
                      setShowScheduleView(false);
                      if (session.topics) {
                          const formattedTopics: TopicProgress[] = session.topics.map((t: any) => ({
                              name: t.name_topic || t.name || "",
                              nameKey: t.name_topic || t.name || "",
                              percentage: t.score !== undefined ? Number(t.score) : 0,
                              icon: "🎓"
                          }));
                          setTopics(formattedTopics);
                          setOverallPerformance(Number((session as any).student_score_average) || 0);
                          
                          const summary = (session as any).student_ai_summary || (session as any).ai_summary || "Session details loaded.";
                          setStudentInsights({ summary, issues: [] });
                          setDisplayedSummary(summary);
                      }
                  }}
                  selectedSessionId={activeSession?.id_class}
              />
            </div>
          </div>
        </div>
      )}

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
