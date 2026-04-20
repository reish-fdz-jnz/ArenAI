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
  happyOutline,
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
  const [overallPerformance, setOverallPerformance] = useState<number | null>(0);
  const animatedPerformance = useAnimatedScore(overallPerformance);
  const [viewMode, setViewMode] = useState<"state" | "que">("state");
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  // Chatbot questions & summary state
  const [chatbotQuestions, setChatbotQuestions] = useState<any[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsSummary, setQuestionsSummary] = useState<{
    summary: string;
    topDoubts: string[];
    avgFrustration: string;
    generatedAt: string;
  } | null>(null);

  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const issueTimeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // --- REAL-TIME UPDATES ---
  useEffect(() => {
    socketService.connect();
    const socket = socketService.socket;
    if (!socket) return;

    // 1. Mastery & Score Updates
    socket.on('class_score_update', (data: { topicId: number; sectionMastery: number }) => {
      setTopics(prevTopics => prevTopics.map(topic => 
        topic.id === data.topicId ? { ...topic, percentage: data.sectionMastery } : topic
      ));
    });

    socket.on('class_overall_update', (data: { classId: number; overallAverage: number }) => {
      setOverallPerformance(Math.round(data.overallAverage));
    });

    socket.on('class_score_update', (data: { classId: number; topicId: number; scoreAverage: number; sectionMastery: number }) => {
      // Update individual topics in real-time
      setTopics(prev => prev.map(topic => {
        if (topic.id === data.topicId) {
          return { ...topic, percentage: Math.round(data.scoreAverage) };
        }
        return topic;
      }));
    });

    // 2. Session Lifecycle (Live Sync)
    socket.on('class_started', (data: { classId: number; sectionId: number }) => {
      console.log("[Main_Prof] Live Class Started:", data);
      // Clear current focus preference to ensure it jumps to the new session
      const dateStr = new Date().toISOString().split('T')[0];
      localStorage.removeItem(`prefSession_${dateStr}`);
      
      setTopics([]); // Clear old topics immediately
      setOverallPerformance(null);
      fetchDashboardSync();
    });

    socket.on('class_finished', (data: { classId: number; sectionId: number }) => {
      console.log("[Main_Prof] Live Class Finished:", data);
      setActiveSession(null);
      setFocusSession(null);
      setTopics([]);
      setOverallPerformance(null);
      fetchDashboardSync();
    });

    // 3. AI Insights
    socket.on('insight_update', (data: any) => {
      if (data.data?.status === "report_saved" || data.data?.status === "summary_saved") {
        fetchClassInsights(true);
      }
    });

    // 4. Recovery Resync
    const unregisterResync = socketService.onResync(() => {
      console.log("[Main_Prof] Socket recovered, re-fetching...");
      fetchDashboardSync(selectedDate);
    });

    return () => {
      socket.off('class_score_update');
      socket.off('class_overall_update');
      socket.off('class_started');
      socket.off('class_finished');
      socket.off('insight_update');
      unregisterResync();
    };
  }, [selectedGrade, selectedSection, selectedSubject]); // Re-bind on context change

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
      // Preference: 1. Previously selected, 2. Running session, 3. First of day (if not Today)
      const storedId = localStorage.getItem(`prefSession_${dateStr}`);
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      
      // Force focus on running session if it's today
      let targetFocus: DailySession | null = null;
      if (isToday) {
        targetFocus = merged.find(s => s.status === 'running') || null;
      }
      
      if (!targetFocus) {
        targetFocus = merged.find(s => String(s.id_class) === storedId) || null;
      }
      
      if (!targetFocus && !isToday) {
        targetFocus = merged[0] || null;
      }
      
      updateFocus(targetFocus, false);
      // Fetch mastery immediately with the confirmed id_class to lock session topics
      fetchSectionMastery(targetFocus?.id_class, targetFocus);

    } catch (err) {
      console.error("Dashboard sync error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSectionMastery = async (classId?: number, currentSession?: DailySession | null) => {
    try {
      const token = localStorage.getItem("authToken");
      
      const sessionToUse = activeSession || focusSession;
      const targetId = classId || sessionToUse?.id_class;
      const classIdParam = targetId ? `&classId=${targetId}` : "";
      const url = getApiUrl(`api/sections/progress?grade=${selectedGrade}&sectionNumber=${selectedSection}&subject=${selectedSubject}${classIdParam}`);
      
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          // Filter: If we are in session mode, 'data' already contains only class_topics
          // If we are in idle mode, 'data' contains all section topics.
          const processed = data.map((t: any) => {
            let score = (t.score !== undefined && t.score !== null) ? Number(t.score) : null;
            if (score !== null && score > 0 && score <= 1) score = score * 100;

            return {
              id: t.id_topic || t.id,
              name: t.name_topic || t.name,
              percentage: score,
              base_score_session: t.base_score_session,
              icon: getIconForTopic(t.name_topic || t.name)
            };
          });

          // Strict assignment to setTopics
          setTopics(processed);
          
          // Calculate Overall Average from base_score_session as requested
          const baseScores = data
            .filter((t: any) => t.base_score_session !== null && t.base_score_session !== undefined)
            .map((t: any) => {
              let s = Number(t.base_score_session);
              // Ensure 0-100 scale
              return (s > 0 && s <= 1) ? s * 100 : s;
            });

          if (baseScores.length > 0) {
            const avg = baseScores.reduce((a: number, b: number) => a + b, 0) / baseScores.length;
            setOverallPerformance(Math.round(avg));
          } else {
            // Fallback to legacy extraction if base_score_session is not yet available
            const score = sessionToUse?.score_average ?? 
                          sessionToUse?.AverageScore ?? 
                          sessionToUse?.overallAverage ?? 
                          sessionToUse?.overall_average ?? 
                          sessionToUse?.student_score_average ?? 
                          sessionToUse?.score;
            
            if (score !== null && score !== undefined && !isNaN(Number(score))) {
              setOverallPerformance(Number(score));
            } else {
              const validScores = processed.filter((p: any) => p.percentage !== null).map((p: any) => p.percentage!);
              if (validScores.length > 0) {
                const sum = validScores.reduce((acc: number, val: number) => acc + val, 0);
                setOverallPerformance(Math.round(sum / validScores.length));
              } else {
                setOverallPerformance(0);
              }
            }
          }
        } else {
          setOverallPerformance(0);
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
      setOverallPerformance(null);
      return;
    }

    // Persist preference
    const dateStr = new Date(session.start_time || '').toISOString().split('T')[0];
    localStorage.setItem(`prefSession_${dateStr}`, String(session.id_class));

    // Normalize topics from session if they have scores
    const rawTopics = session.topics || [];
    const processedTopics = rawTopics.map((t: any) => {
      let score = (t.score !== undefined && t.score !== null) ? Number(t.score) : null;
      if (score !== null && score > 0 && score <= 1) {
        score = score * 100;
      }
      return {
        id: t.id_topic || t.id,
        name: t.name_topic || t.name,
        nameKey: t.name_topic || t.name,
        percentage: score,
        icon: getIconForTopic(t.name_topic || t.name),
      };
    });
    
    setTopics(processedTopics);
    
    // Use session average if available immediately, default to 0 to ensure colored border
    const score = session?.score_average ?? 
                  session?.AverageScore ?? 
                  session?.overallAverage ?? 
                  session?.overall_average ??
                  session?.student_score_average ?? 
                  session?.score;
    setOverallPerformance(Number(score) || 0);
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
      // Removed stray fetchSectionMastery() call - fetchDashboardSync handles it with proper class locking
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
      const targetId = activeSession?.id_class || focusSession?.id_class;
      if (!targetId) {
        setInsightsLoading(false);
        return;
      }
      
      const url = getApiUrl(`/ai/class-insights?classId=${targetId}`);
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
          const rawInsight = data.insights[0];
          
          // Robust parsing of summary if it's a JSON string
          if (typeof rawInsight.summary === 'string' && rawInsight.summary.trim().startsWith('{')) {
              try {
                  const parsed = JSON.parse(rawInsight.summary);
                  summary = parsed.summary || parsed.general_summary || rawInsight.summary;
              } catch (e) {
                  summary = rawInsight.summary;
              }
          } else {
              summary = rawInsight.summary || "";
          }

          data.insights.forEach((insight: any) => {
            const weaknesses = insight.weaknesses || [];
            allWeaknesses.push(...weaknesses);
          });
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

  // Fetch chatbot questions and summary when switching to "que" tab
  useEffect(() => {
    if (viewMode !== 'que') return;

    const targetId = activeSession?.id_class || focusSession?.id_class;

    const fetchData = async () => {
      setQuestionsLoading(true);
      try {
        const token = localStorage.getItem('authToken');
        
        // 1. Fetch raw questions
        const qUrl = getApiUrl(`/ai/chatbot-questions?limit=20${targetId ? `&classId=${targetId}` : ''}`);
        const qRes = await fetch(qUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (qRes.ok) {
          const qData = await qRes.json();
          setChatbotQuestions(qData.questions || []);
        }

        // 2. Fetch AI Questions Summary
        if (targetId) {
          const sUrl = getApiUrl(`/ai/questions-summary?classId=${targetId}`);
          const sRes = await fetch(sUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData.success) {
              setQuestionsSummary({
                summary: sData.summary,
                topDoubts: sData.topDoubts,
                avgFrustration: sData.avgFrustration,
                generatedAt: sData.generatedAt
              });
            } else {
              setQuestionsSummary(null);
            }
          }
        }
      } catch (err) {
        console.error('[Main_Prof] Error fetching chatbot data:', err);
      } finally {
        setQuestionsLoading(false);
      }
    };

    fetchData();
  }, [viewMode, activeSession, focusSession]);

  // Logic for manual generation removed in favor of background automation


  const navigateTo = (path: string) => router.push(path, 'forward', 'push');

  const navigateToTopic = (topic: TopicProgress) => {
    if (topic.id) {
      router.push(`/page/class-topic/${topic.id}?grade=${selectedGrade}&section=${selectedSection}`, 'forward', 'push');
    } else {
      router.push(`/subject/${selectedSubject}`, 'forward', 'push');
    }
  };

  const getColorForPercentage = (percentage: number) => {
    const p = Math.max(0, Math.min(100, percentage));
    
    if (p >= 80) return "#2ecc71"; // Success Green
    if (p >= 60) return "#f39c12"; // Warning Orange/Yellow
    return "#FF5252"; // Danger Red
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
                  <div className="ms-your-math-pill" style={{ fontSize: '14px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeSession && activeSession.id_class === focusSession?.id_class && (
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FF5252', animation: 'blink 1s step-end infinite' }}></div>
                    )}
                    <span>
                      {activeSession && activeSession.id_class === focusSession?.id_class ? "LIVE: " : ""}
                      {focusSession?.name_session || t("professor.dashboard.yourClass", {
                        subject: t(
                          "professor.dashboard.subjects." +
                          selectedSubject.replace(/\s+/g, ""),
                        ),
                      })}
                    </span>
                  </div>
                  <div
                    className="ms-progress-circle"
                    style={{
                      border: (animatedPerformance !== null)
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
                      fontSize: (animatedPerformance !== null) ? "18px" : "28px",
                      backgroundColor: (animatedPerformance !== null)
                        ? "var(--ion-color-secondary)"
                        : "rgba(255, 255, 255, 0.1)",
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                      transition: "border-color 0.5s ease"
                    }}
                  >
                    {animatedPerformance !== null ? `${Math.round(animatedPerformance)}%` : "0%"}
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
                        classId={activeSession?.id_class}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (topics.length > 0) ? (
              /* SHOW SECTION MASTERY EVEN IF NO SESSION ACTIVE TODAY */
              <>
                <div className="ms-stats-row">
                  <div className="ms-your-math-pill" style={{ fontSize: '14px', padding: '8px 16px' }}>
                    {t("professor.dashboard.sectionMastery", "Section Mastery")}
                  </div>
                  <div
                    className="ms-progress-circle"
                    style={{
                      border: (animatedPerformance !== null)
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
                      fontSize: (animatedPerformance !== null) ? "18px" : "28px",
                      backgroundColor: "var(--ion-color-secondary)",
                      transition: "border-color 0.5s ease"
                    }}
                  >
                    {animatedPerformance !== null ? `${Math.round(animatedPerformance)}%` : "0%"}
                  </div>
                </div>

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
                        classId={focusSession?.id_class}
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
                          {/* Manual button removed in favor of periodic background updates */}
                        </>
                      ) : (
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontStyle: "italic", opacity: 0.9, color: "white", textAlign: "center", width: "100%", marginBottom: '16px' }}>
                            {t(
                              "professor.dashboard.nothingToSummarize",
                              "Nothing to summarize yet",
                            )}
                          </p>
                          <p style={{ fontSize: '11px', opacity: 0.7, color: 'white' }}>
                            {t("professor.dashboard.waitingForData", "Analizando actividad de la clase en segundo plano...")}
                          </p>
                        </div>
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
                      ) : (
                        <>
                          {questionsSummary && (
                            <div style={{
                              background: 'rgba(107, 107, 255, 0.15)',
                              borderRadius: '16px',
                              padding: '12px 14px',
                              marginBottom: '14px',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              backdropFilter: 'blur(5px)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <IonIcon icon={planetOutline} style={{ color: '#8E53FF', fontSize: '18px' }} />
                                <span style={{ fontWeight: '700', fontSize: '13px', color: 'white' }}>Resumen de Dudas (IA)</span>
                                <span style={{ 
                                  marginLeft: 'auto', 
                                  fontSize: '10px', 
                                  background: questionsSummary.avgFrustration === 'high' ? '#e74c3c' : questionsSummary.avgFrustration === 'medium' ? '#f39c12' : '#2ecc71',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  color: 'white'
                                }}>
                                  Frustración: {questionsSummary.avgFrustration}
                                </span>
                              </div>
                              <p style={{ fontSize: '12px', lineHeight: '1.5', color: 'rgba(255,255,255,0.9)', margin: '0 0 8px 0' }}>
                                {questionsSummary.summary}
                              </p>
                              {questionsSummary.topDoubts.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {questionsSummary.topDoubts.map((doubt, i) => (
                                    <span key={i} style={{ 
                                      fontSize: '10px', 
                                      background: 'rgba(255,255,255,0.1)', 
                                      padding: '3px 8px', 
                                      borderRadius: '10px',
                                      color: 'rgba(255,255,255,0.8)'
                                    }}>
                                      ⚠️ {doubt}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {chatbotQuestions.length > 0 ? (
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
                        ))) : (
                          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', fontSize: '13px' }}>
                            {t('professor.dashboard.noQuestions', 'No hay preguntas registradas aún')}
                          </p>
                        )}
                        </>
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
