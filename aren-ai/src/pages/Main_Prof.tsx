import React, { useState, useEffect, useRef } from "react";
import { useAvatar } from "../context/AvatarContext";
import {
  IonContent,
  IonPage,
  IonIcon,
  IonHeader,
  IonToolbar,
  IonMenuButton,
  useIonViewWillEnter,
  useIonRouter,
} from "@ionic/react";
import {
  calculator,
  menu,
  chatbubbleEllipsesOutline,
  settingsOutline,
  clipboardOutline,
  analyticsOutline,
  chevronBackOutline,
  chevronForwardOutline,
  infiniteOutline,
  flaskOutline,
  statsChartOutline,
  createOutline,
  libraryOutline,
  leafOutline,
  planetOutline,
  nuclearOutline,
  globeOutline,
  mapOutline,
  earthOutline,
  languageOutline,
  chatbubblesOutline,
  bookOutline,
  pencilOutline,
  schoolOutline,
} from "ionicons/icons";
import "./Main_Prof.css";
import "../components/ProfessorHeader.css";
import ProfessorMenu from "../components/ProfessorMenu";
import { useProfessorFilters } from "../hooks/useProfessorFilters";
import { useTranslation } from "react-i18next";
import { getApiUrl } from "../config/api";
import AnimatedMascot from "../components/AnimatedMascot";
import { CalendarSelector } from "../components/CalendarSelector";
import { TopicProgress } from "../types/student";
import PageTransition from "../components/PageTransition";
import { socketService } from "../services/socket";
import { DailyScheduleView, DailySession } from "../components/DailyScheduleView";
import { useAnimatedScore } from "../hooks/useAnimatedScore";
import ProfessorTopicBubble from "../components/ProfessorTopicBubble";

const Main_Prof: React.FC = () => {
  const router = useIonRouter();
  const { t } = useTranslation();
  const { getAvatarAssets } = useAvatar();
  const avatarAssets = getAvatarAssets();

  const {
    selectedGrade,
    setSelectedGrade,
    selectedSection,
    setSelectedSection,
    selectedSubject,
    setSelectedSubject,
  } = useProfessorFilters();
  const [activeSession, setActiveSession] = useState<DailySession | null>(null);
  const [focusSession, setFocusSession] = useState<DailySession | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dailySessions, setDailySessions] = useState<DailySession[]>([]);
  const [sessionHistory, setSessionHistory] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showScheduleView, setShowScheduleView] = useState(false);

  // Class insights state
  const [classInsights, setClassInsights] = useState<{
    summary: string;
    issues: string[];
  } | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Typing animation state
  const [displayedSummary, setDisplayedSummary] = useState("");
  const [displayedIssues, setDisplayedIssues] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const [topics, setTopics] = useState<TopicProgress[]>([]);
  const [overallPerformance, setOverallPerformance] = useState(0);
  const animatedPerformance = useAnimatedScore(overallPerformance);
  const [viewMode, setViewMode] = useState<"state" | "que">("state");
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  // Chatbot questions state
  const [chatbotQuestions, setChatbotQuestions] = useState<any[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const issueTimeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // --- REAL-TIME UPDATES ---
  useEffect(() => {
    socketService.connect();
    const socket = socketService.socket;
    if (!socket) return;

    socket.on('class_score_update', (data: { topicId: number; sectionMastery: number }) => {
      console.log("[Main_Prof] Live topic score update received:", data);
      
      setTopics(prevTopics => {
        return prevTopics.map(topic => {
          if (topic.id === data.topicId) {
            return {
              ...topic,
              percentage: data.sectionMastery
            };
          }
          return topic;
        });
      });
    });

    socket.on('class_overall_update', (data: { classId: number; overallAverage: number }) => {
      console.log("[Main_Prof] Live overall class score update received:", data);
      setOverallPerformance(Math.round(data.overallAverage));
    });

    return () => {
      socket.off('class_score_update');
      socket.off('class_overall_update');
    };
  }, []);

  const fetchDashboardSync = async (targetDate: Date = selectedDate) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("authToken");
      const offset = new Date().getTimezoneOffset();
      
      const dateStr = [
        targetDate.getFullYear(),
        String(targetDate.getMonth() + 1).padStart(2, '0'),
        String(targetDate.getDate()).padStart(2, '0')
      ].join('-');

      // 1. Fetch Session History (for calendar dots)
      const historyUrl = getApiUrl(`api/class-templates/history?grade=${selectedGrade}&sectionNumber=${selectedSection}&timezoneOffset=${offset}`);
      const hRes = await fetch(historyUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      const hData = await hRes.json();
      if (hData && typeof hData === 'object') setSessionHistory(hData);

      // 2. Fetch Active Session
      let activeS: DailySession | null = null;
      const activeUrl = getApiUrl(`api/class-templates/active?grade=${selectedGrade}&sectionNumber=${selectedSection}`);
      const aRes = await fetch(activeUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (aRes.ok) {
        const aData = await aRes.json();
        activeS = aData?.data !== undefined ? aData.data : aData;
        if (activeS && !activeS.id_class) activeS = null;
        setActiveSession(activeS);
      } else {
        setActiveSession(null);
      }

      // 3. Fetch Sessions by Date (UTC Range robust fix)
      const byDateUrl = getApiUrl(`api/class-templates/by-date?date=${dateStr}&grade=${selectedGrade}&sectionNumber=${selectedSection}&timezoneOffset=${offset}`);
      const bRes = await fetch(byDateUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      const bData = await bRes.json();
      const fetchedSessions: DailySession[] = Array.isArray(bData) ? bData : (bData && bData.id_class ? [bData] : []);

      // Merge logic: ensure active session is in the list
      const merged = [...fetchedSessions];
      if (activeS && !merged.some(s => s.id_class === activeS!.id_class)) {
        // Only merge if active session belongs to the selected date
        const sessDate = new Date(activeS.start_time || '').toISOString().split('T')[0];
        // Note: this check is loose (UTC), but merging is safer for UX
        merged.push(activeS);
      }
      setDailySessions(merged);

      // 4. Update Focus Session
      // Preference: 1. Previously selected for this date, 2. Running session, 3. First session of the day
      const storedId = localStorage.getItem(`prefSession_${dateStr}`);
      let targetFocus = merged.find(s => String(s.id_class) === storedId);
      
      if (!targetFocus) {
        targetFocus = merged.find(s => s.status === 'running') || merged[0] || null;
      }
      
      updateFocus(targetFocus, false);
      fetchSectionMastery();

    } catch (err) {
      console.error("Dashboard sync error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSectionMastery = async () => {
    try {
      const token = localStorage.getItem("authToken");
      // Use classId in URL if we have a focusSession to only show topics of that session
      const classIdParam = focusSession?.id_class ? `&classId=${focusSession.id_class}` : "";
      const url = getApiUrl(`api/sections/progress?grade=${selectedGrade}&sectionNumber=${selectedSection}&subject=${selectedSubject}${classIdParam}`);
      
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const processed = data.map((t: any) => ({
            id: t.id_topic,
            name: t.name_topic || t.name,
            percentage: t.score,
            icon: getIconForTopic(t.name_topic || t.name)
          }));
          setTopics(processed);
          
          // Only update overall performance from progress if not in a session 
          // (Session overall is updated by its own metrics usually, but this is a good backup)
          if (!focusSession) {
            const total = processed.reduce((acc: number, t: any) => acc + (t.percentage || 0), 0);
            const avg = processed.length ? total / processed.length : 0;
            setOverallPerformance(Math.round(avg));
          }
        }
      }
    } catch (err) {
      console.error("Section mastery fetch error:", err);
    }
  };

  const updateFocus = (session: DailySession | null, shouldCloseUI: boolean = true) => {
    setFocusSession(session);
    if (shouldCloseUI) setShowScheduleView(false);
    if (!session) {
      setTopics([]);
      setOverallPerformance(0);
      return;
    }

    // Persist preference
    const dateStr = new Date(session.start_time || '').toISOString().split('T')[0];
    localStorage.setItem(`prefSession_${dateStr}`, String(session.id_class));

    // Update widgets
    let rawTopics = session.topics || [];
    const processedTopics = rawTopics.map((t: any) => ({
      name: t.name_topic || t.name,
      nameKey: t.name_topic || t.name,
      percentage: 0, // Initial percentage should be 0 unless real data found
      icon: getIconForTopic(t.name_topic || t.name),
    }));
    
    setTopics(processedTopics);
    setOverallPerformance(0); // Initial performance should be 0
  };

  // Stable Icon Mapping helper
  const getIconForTopic = (name: string): string => {
    const t = (name || "").toLowerCase();
    if (t.includes("algeb")) return "∑";
    if (t.includes("geom")) return "📐";
    if (t.includes("calc")) return "∫";
    if (t.includes("stat")) return "📊";
    if (t.includes("bio")) return "🧬";
    if (t.includes("chem")) return "🧪";
    if (t.includes("phys")) return "⚛️";
    if (t.includes("hist")) return "📜";
    if (t.includes("geo")) return "🗺️";
    if (t.includes("voc")) return "🗣️";
    if (t.includes("gram")) return "📝";
    return "🎓";
  };

  const handleDateSelect = (date: Date) => {
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && 
                    date.getMonth() === today.getMonth() && 
                    date.getFullYear() === today.getFullYear();
    
    if (isToday) {
      handleExitReview();
    } else {
      setSelectedDate(date);
      setShowScheduleView(true);
      fetchDashboardSync(date);
      fetchSectionMastery();
    }
  };

  const handleGoToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setShowScheduleView(false);
    fetchDashboardSync(today);
  };



  // Initial fetch on mount/subject change
  useEffect(() => {
    fetchDashboardSync();
  }, [selectedGrade, selectedSection, selectedSubject, t]);

  useIonViewWillEnter(() => {
    fetchDashboardSync();
  });

  const handleExitReview = () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    localStorage.removeItem(`prefSession_${dateStr}`); // Clear preference for today
    
    setSelectedDate(today);
    fetchDashboardSync(today);
  };

  // Dynamic Insights
  // Needs mapping for "Social Studies" vs key in JSON if there's a mismatch.
  // In JSON "SocialStudies" (no space). In state 'Social Studies' (space).
  const getInsightKey = (subject: string) => {
    if (subject === "Social Studies") return "SocialStudies";
    return subject;
  };

  const subjectKey = getInsightKey(selectedSubject);

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
          );
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

  // Fetch class insights from API
  const fetchClassInsights = async (animate: boolean = false) => {
    console.log("[Debug] fetchClassInsights CALLED");
    setInsightsLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const url = getApiUrl(`/ai/class-insights?classId=1`);
      console.log("[Debug] Fetching:", url);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("[Debug] Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log(
          "[Debug] Class insights API response:",
          JSON.stringify(data),
        );

        let summary = "";
        const allWeaknesses: string[] = [];

        if (data.insights && data.insights.length > 0) {
          console.log("[Debug] Found", data.insights.length, "insights");
          summary = data.insights[0].summary || "";
          console.log("[Debug] First insight summary:", summary);

          data.insights.forEach((insight: any) => {
            const weaknesses = insight.weaknesses || [];
            allWeaknesses.push(...weaknesses);
          });
        } else {
          console.log("[Debug] No insights in response");
        }

        const uniqueWeaknesses = [...new Set(allWeaknesses)];

        setClassInsights({
          summary: summary,
          issues: uniqueWeaknesses.slice(0, 5),
        });

        // Trigger typing animation if requested (new report)
        if (animate && summary) {
          startTypingAnimation(summary, uniqueWeaknesses.slice(0, 5));
        } else {
          setDisplayedSummary(summary);
          setDisplayedIssues(uniqueWeaknesses.slice(0, 5));
        }
      } else {
        console.log(
          "[Debug] Response NOT OK:",
          response.status,
          await response.text(),
        );
        setClassInsights(null);
        setDisplayedSummary("");
        setDisplayedIssues([]);
      }
    } catch (err) {
      console.error("[Debug] Error fetching class insights:", err);
      setClassInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  };

  // Initial fetch on mount/subject change
  useEffect(() => {
    fetchClassInsights(false);
  }, [selectedSubject]);

  // Fetch chatbot questions when switching to "que" tab
  useEffect(() => {
    if (viewMode !== 'que') return;

    const fetchChatbotQuestions = async () => {
      setQuestionsLoading(true);
      try {
        const token = localStorage.getItem('authToken');
        const url = getApiUrl(`/ai/chatbot-questions?limit=20`);
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setChatbotQuestions(data.questions || []);
        }
      } catch (err) {
        console.error('[Main_Prof] Error fetching chatbot questions:', err);
      } finally {
        setQuestionsLoading(false);
      }
    };

    fetchChatbotQuestions();
  }, [viewMode]);

  // WebSocket listener for real-time report updates
  useEffect(() => {
    socketService.connect();

    const handleInsightUpdate = (data: {
      timestamp: string;
      message: string;
      data?: any;
    }) => {
      console.log("[Main_Prof] Insight update received:", data);

      // Check if this is a class report saved - refetch for professor
      if (
        data.data?.status === "report_saved" ||
        data.data?.status === "summary_saved"
      ) {
        console.log("[Main_Prof] New class report - refetching with animation");
        fetchClassInsights(true); // Refetch with animation
      }
    };

    const handleClassScoreUpdate = (data: { topicId: number; scoreAverage: number }) => {
      console.log("[Main_Prof] Class score update received:", data);
      // Update the specific topic in the list
      setTopics(prev => prev.map(t => t.id === data.topicId ? { ...t, percentage: data.scoreAverage } : t));
      
      // Re-calculate overall performance based on current visible topics
      setTopics(prev => {
        const total = prev.reduce((acc, t) => acc + (t.percentage || 0), 0);
        const avg = prev.length ? total / prev.length : 0;
        setOverallPerformance(Math.round(avg));
        return prev;
      });
    };

    // Register re-sync logic for when the socket recovers from a drop
    const unregisterResync = socketService.onResync(() => {
      console.log("[Main_Prof] Socket recovered, re-fetching dashboard state...");
      fetchDashboardSync(selectedDate);
    });

    socketService.socket?.on("insight_update", handleInsightUpdate);
    socketService.socket?.on("class_score_update", handleClassScoreUpdate);

    return () => {
      unregisterResync();
      socketService.socket?.off("insight_update", handleInsightUpdate);
      socketService.socket?.off("class_score_update", handleClassScoreUpdate);
    };
  }, []);

  const navigateTo = (path: string) => router.push(path, 'forward', 'push');

  const navigateToTopic = (topic: TopicProgress) => {
    if (topic.id) {
      router.push(`/page/class-topic/${topic.id}?grade=${selectedGrade}&section=${selectedSection}`, 'forward', 'push');
    } else {
      router.push(`/subject/${selectedSubject}`, 'forward', 'push');
    }
  };

  const getColorForPercentage = (p: number) => {
    // Smooth HSL transition: 0 is Red, 120 is Emerald Green
    const hue = Math.min(120, (p * 1.2)); 
    // Saturation stays high for vibrancy, lightness adjusted for glassmorphism
    return `hsla(${hue}, 75%, 45%, 0.85)`;
  };

  return (
    <IonPage className="main-student-page global-background-pattern">
      <IonHeader className="professor-header-container">
        <IonToolbar color="primary" className="professor-toolbar">
          <div className="ph-content">
            <IonMenuButton className="ph-menu-btn">
              <IonIcon icon={menu} />
            </IonMenuButton>
          </div>
        </IonToolbar>

        {/* Brand / Title - Outside Toolbar for Z-Index control */}
        <div className="ph-brand-container-absolute">
          <div className="ph-brand-name">ArenAI</div>
          <div className="ph-brand-sub">Professor</div>
        </div>

        {/* Notch with three dropdowns */}
        <div className="ph-notch-container">
          <div className="ph-notch">
            <div className="ph-dropdowns-display">
              <div className="ph-text-oval">
                <ProfessorMenu
                  selectedGrade={String(selectedGrade)}
                  selectedSection={selectedSection}
                  selectedSubject={t(
                    "professor.dashboard.subjects." +
                    selectedSubject.replace(/\s+/g, ""),
                  )}
                  onGradeChange={(grade) =>
                    setSelectedGrade(parseInt(grade, 10))
                  }
                  onSectionChange={setSelectedSection}
                  onSubjectChange={setSelectedSubject}
                />
              </div>
            </div>
          </div>
        </div>
      </IonHeader>
      <IonContent fullscreen className="student-page-content">
        <PageTransition variant="fade">
          <div className="ms-container">
            <div className="ms-week-selector">
              <CalendarSelector
                onDateSelect={handleDateSelect}
                sessionMarkers={sessionHistory}
                title={t("professor.dashboard.classSchedule")}
              />
              {focusSession && (!activeSession || focusSession.id_class !== activeSession.id_class) && (
                (() => {
                  const today = new Date();
                  const isToday = selectedDate.getDate() === today.getDate() && 
                                  selectedDate.getMonth() === today.getMonth() && 
                                  selectedDate.getFullYear() === today.getFullYear();
                  return !isToday;
                })()
              ) && (
                <div 
                  className="ms-return-today-pill"
                  onClick={handleExitReview}
                  style={{ top: '65px' }} // Slightly below the calendar title if needed, or adjust CSS
                >
                  <IonIcon icon={statsChartOutline} />
                  <span>{t('common.exitReview')}</span>
                </div>
              )}

              {showScheduleView && (
                <div className="ms-timeline-overlay" onClick={() => setShowScheduleView(false)}>
                  <div className="ms-timeline-popup" onClick={(e) => e.stopPropagation()}>
                    <div className="ms-popup-header">
                      <span className="ms-popup-title">
                        {t('professor.dashboard.selectSession', 'Daily Schedule')}
                      </span>
                      <button 
                        className="ms-popup-close"
                        onClick={() => setShowScheduleView(false)}
                      >
                        {t('common.close', 'Close')}
                      </button>
                    </div>
                    <div className="ms-popup-body">
                      <DailyScheduleView 
                        date={selectedDate}
                        sessions={dailySessions}
                        onSessionSelect={updateFocus}
                        selectedSessionId={focusSession?.id_class}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {activeSession ? (
              <>
                <div className="ms-stats-row">
                  <div className="ms-your-math-pill" style={{ fontSize: '14px', padding: '8px 16px' }}>
                    {focusSession?.name_session || t("professor.dashboard.yourClass", {
                      subject: t(
                        "professor.dashboard.subjects." +
                        selectedSubject.replace(/\s+/g, ""),
                      ),
                    })}
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
                      <ProfessorTopicBubble 
                        key={`${index}-${topic.id}`}
                        topic={topic}
                        index={index}
                        getColorForPercentage={getColorForPercentage}
                        expandedTopic={expandedTopic}
                        setExpandedTopic={setExpandedTopic}
                        selectedSubject={selectedSubject}
                        selectedGrade={selectedGrade}
                        selectedSection={selectedSection}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : topics.length > 0 ? (
                /* Fallback to Section Mastery (History) if no session focused */
                <>
                <div className="ms-stats-row">
                  <div className="ms-your-math-pill" style={{ fontSize: '14px', padding: '8px 16px' }}>
                    {t("professor.dashboard.classHistory", "Class History")}
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
                      backgroundColor: "var(--ion-color-secondary)",
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
                      <ProfessorTopicBubble 
                        key={`${index}-${topic.id}`}
                        topic={topic}
                        index={index}
                        getColorForPercentage={getColorForPercentage}
                        expandedTopic={expandedTopic}
                        setExpandedTopic={setExpandedTopic}
                        selectedSubject={selectedSubject}
                        selectedGrade={selectedGrade}
                        selectedSection={selectedSection}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="ms-empty-session" style={{ textAlign: 'center', margin: '40px 20px', color: 'rgba(255, 255, 255, 0.9)', padding: '30px 20px', borderRadius: '24px', backgroundColor: 'rgba(0, 0, 0, 0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <IonIcon icon={schoolOutline} style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--ion-color-secondary)' }} />
                <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: '700' }}>No Active Class Session</h3>
                <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.5', opacity: 0.8 }}>Choose a grade and section above to view the active session widget, or launch a new class.</p>
              </div>
            )}

            <div className="ms-bottom-section">
              <div className="ms-switch-container">
                <div
                  className={`ms-switch-option ${viewMode === "state" ? "active" : ""
                    }`}
                  onClick={() => setViewMode("state")}
                >
                  {t("professor.dashboard.stateOfClass", "State of Class")}
                </div>
                <div
                  className={`ms-switch-option ${viewMode === "que" ? "active" : ""
                    }`}
                  onClick={() => setViewMode("que")}
                >
                  {t("professor.dashboard.questions")}
                </div>
                <div
                  className="ms-switch-bg"
                  style={{
                    transform:
                      viewMode === "que" ? "translateX(100%)" : "translateX(0)",
                  }}
                />
              </div>
              <div className="ms-info-display">
                {viewMode === "state" ? (
                  <>
                    <div
                      className="ms-info-content"
                      style={{
                        fontSize: "13px",
                        lineHeight: "1.6",
                        textAlign: "center",
                        color: "white"
                      }}
                    >
                      {insightsLoading ? (
                        <p>{t("common.loading", "Loading...")}</p>
                      ) : classInsights &&
                        (classInsights.summary ||
                          classInsights.issues.length > 0) ? (
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
                              {displayedIssues.map(
                                (issue: string, idx: number) => (
                                  <li
                                    key={idx}
                                    style={{
                                      marginBottom: "4px",
                                      animation: "fadeIn 0.3s ease-in",
                                    }}
                                  >
                                    {issue}
                                  </li>
                                ),
                              )}
                            </ul>
                          )}
                        </>
                      ) : (
                        <p style={{ fontStyle: "italic", opacity: 0.9, color: "white", textAlign: "center", width: "100%" }}>
                          {t(
                            "professor.dashboard.nothingToSummarize",
                            "Nothing to summarize yet",
                          )}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="ms-info-title">
                      {t("professor.dashboard.popularQuestions")}
                    </div>
                    <div className="ms-info-content" style={{ maxHeight: '180px', overflowY: 'auto', padding: '0 4px' }}>
                      {questionsLoading ? (
                        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>
                          {t('common.loading', 'Cargando...')}
                        </p>
                      ) : chatbotQuestions.length > 0 ? (
                        chatbotQuestions.map((q: any, idx: number) => (
                          <div key={q.id || idx} style={{
                            background: 'rgba(255,255,255,0.08)',
                            borderRadius: '12px',
                            padding: '10px 12px',
                            marginBottom: '8px',
                            borderLeft: q.frustration === 'high' ? '3px solid #e74c3c'
                              : q.frustration === 'medium' ? '3px solid #f39c12'
                              : '3px solid #2ecc71'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span style={{
                                fontSize: '10px',
                                background: 'rgba(255,255,255,0.15)',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                color: 'rgba(255,255,255,0.9)'
                              }}>
                                🏷️ {q.topic}
                              </span>
                              <span style={{ fontSize: '12px' }}>
                                {q.frustration === 'high' ? '😰' : q.frustration === 'medium' ? '😐' : '😊'}
                              </span>
                              <span style={{
                                fontSize: '10px',
                                color: 'rgba(255,255,255,0.5)',
                                marginLeft: 'auto'
                              }}>
                                {q.studentName}
                              </span>
                            </div>
                            <p style={{
                              margin: 0,
                              fontSize: '12px',
                              lineHeight: '1.4',
                              color: 'rgba(255,255,255,0.85)'
                            }}>
                              "{q.question.length > 120 ? q.question.substring(0, 120) + '...' : q.question}"
                            </p>
                          </div>
                        ))
                      ) : (
                        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', fontSize: '13px' }}>
                          {t('professor.dashboard.noQuestions', 'No hay preguntas registradas aún')}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </PageTransition>
      </IonContent>
      <div className="student-bottom-nav">
        <div
          className="student-nav-btn"
          onClick={() => navigateTo("/chat-menu")}
        >
          <IonIcon icon={chatbubbleEllipsesOutline} />
        </div>
        <div
          className="student-nav-btn"
          onClick={() => navigateTo("/page/quiz-menu")}
        >
          <IonIcon icon={libraryOutline} />
        </div>
        <div className="student-mascot-container">
          <AnimatedMascot
            openSrc={avatarAssets.open}
            closedSrc={avatarAssets.closed}
            winkSrc={avatarAssets.wink}
            className="student-mascot-btn"
            onClick={() => navigateTo("/start-class-session")}
          />
        </div>
        <div
          className="student-nav-btn"
          onClick={() => navigateTo("/page/ai-quiz-generator")}
        >
          <IonIcon icon={clipboardOutline} />
        </div>
        <div
          className="student-nav-btn"
          onClick={() => navigateTo("/professor-settings")}
        >
          <IonIcon icon={settingsOutline} />
        </div>
      </div>
    </IonPage>
  );
};

export default Main_Prof;
