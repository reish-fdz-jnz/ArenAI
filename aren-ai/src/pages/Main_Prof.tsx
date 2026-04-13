import React, { useState, useEffect, useRef } from "react";
import { useAvatar } from "../context/AvatarContext";
import {
  IonContent,
  IonPage,
  IonIcon,
  IonHeader,
  IonToolbar,
  IonMenuButton,
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
import { useHistory } from "react-router-dom";
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

const Main_Prof: React.FC = () => {
  const history = useHistory();
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
  const [topics, setTopics] = useState<TopicProgress[]>([]);
  const [overallPerformance, setOverallPerformance] = useState(0);
  const [viewMode, setViewMode] = useState<"state" | "que">("state");

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
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const issueTimeoutRefs = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    const fetchTopicsFromAPI = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const userStr = localStorage.getItem("userData");
        const user = userStr ? JSON.parse(userStr) : null;
        const userId = user?.id;

        if (userId) {
          // Try to fetch topic progress from API
          const response = await fetch(
            getApiUrl(`api/students/${userId}/progress`),
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (response.ok) {
            const progressData = await response.json();
            // Filter by selected subject and transform
            const subjectTopics = progressData
              .filter((p: any) =>
                p.subject_name
                  .toLowerCase()
                  .includes(selectedSubject.toLowerCase()),
              )
              .map((p: any) => ({
                name: t(
                  `professor.dashboard.topics.${p.topic_name}`,
                  p.topic_name,
                ),
                nameKey: p.topic_name,
                percentage: p.score || 0,
                icon: "📚", // Default icon for API data
              }));

            if (subjectTopics.length > 0) {
              setTopics(subjectTopics);
              const sum = subjectTopics.reduce(
                (acc: number, curr: any) => acc + curr.percentage,
                0,
              );
              setOverallPerformance(Math.round(sum / subjectTopics.length));
              return;
            }
          }
        }
      } catch (err) {
        console.error("Error fetching topics from API:", err);
        // No fallback - just leave empty
        setTopics([]);
        setOverallPerformance(0);
      }
    };

    fetchTopicsFromAPI();
  }, [selectedSubject, t]); // Re-run when subject or language changes

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

    socketService.socket?.on("insight_update", handleInsightUpdate);

    return () => {
      socketService.socket?.off("insight_update", handleInsightUpdate);
    };
  }, []);

  const navigateTo = (path: string) => history.push(path);

  const getColorForPercentage = (p: number) => {
    const ratio = Math.max(0, Math.min(100, p)) / 100;
    const r = Math.round(255 + (120 - 255) * ratio);
    const g = Math.round(82 + (184 - 82) * ratio);
    const b = Math.round(82 + (176 - 82) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
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
                onDateSelect={() => { }}
                title={t("professor.dashboard.classSchedule")}
              />
            </div>
            <div className="ms-stats-row">
              <div className="ms-your-math-pill">
                {t("professor.dashboard.yourClass", {
                  subject: t(
                    "professor.dashboard.subjects." +
                    selectedSubject.replace(/\s+/g, ""),
                  ),
                })}
              </div>
              <div
                className="ms-progress-circle"
                style={{
                  border: `6px solid ${getColorForPercentage(
                    overallPerformance,
                  )}`,
                  boxShadow: "inset 0 0 0 3px white",
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

            <div className="ms-topics-container">
              <div className="ms-topics-header">
                <h3>{t("professor.dashboard.topicPerformance")}</h3>
                <div className="ms-header-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className="ms-topics-list">
                {topics.map((topic, index) => (
                  <div key={index} className="ms-topic-item">
                    <div className="ms-topic-icon">{topic.icon}</div>
                    <div className="ms-topic-content">
                      <div className="ms-topic-info">
                        <span className="ms-topic-name">{topic.name}</span>
                        <span className="ms-topic-percentage">
                          {topic.percentage}%
                        </span>
                      </div>
                      <div className="ms-progress-bar">
                        <div
                          className="ms-progress-fill"
                          style={{
                            width: `${topic.percentage}%`,
                            backgroundColor: getColorForPercentage(
                              topic.percentage,
                            ),
                          }}
                        ></div>
                        {selectedSubject === 'Math' && (
                          <>
                            <IonIcon icon={calculator} className="ms-empty-icon" />
                            <IonIcon icon={infiniteOutline} className="ms-empty-icon" />
                            <IonIcon icon={statsChartOutline} className="ms-empty-icon" />
                            <IonIcon icon={createOutline} className="ms-empty-icon" />
                          </>
                        )}
                        {selectedSubject === 'Science' && (
                          <>
                            <IonIcon icon={flaskOutline} className="ms-empty-icon" />
                            <IonIcon icon={leafOutline} className="ms-empty-icon" />
                            <IonIcon icon={planetOutline} className="ms-empty-icon" />
                            <IonIcon icon={nuclearOutline} className="ms-empty-icon" />
                          </>
                        )}
                        {selectedSubject === 'Social Studies' && (
                          <>
                            <IonIcon icon={globeOutline} className="ms-empty-icon" />
                            <IonIcon icon={mapOutline} className="ms-empty-icon" />
                            <IonIcon icon={earthOutline} className="ms-empty-icon" />
                            <IonIcon icon={schoolOutline} className="ms-empty-icon" />
                          </>
                        )}
                        {selectedSubject === 'Spanish' && (
                          <>
                            <IonIcon icon={languageOutline} className="ms-empty-icon" />
                            <IonIcon icon={chatbubblesOutline} className="ms-empty-icon" />
                            <IonIcon icon={bookOutline} className="ms-empty-icon" />
                            <IonIcon icon={pencilOutline} className="ms-empty-icon" />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
                    <div className="ms-question-carousel">
                      <IonIcon
                        icon={chevronBackOutline}
                        className="ms-carousel-arrow"
                        onClick={() => { }}
                      />
                      <div className="ms-info-content">
                        How can I better explain concepts to my students?
                      </div>
                      <IonIcon
                        icon={chevronForwardOutline}
                        className="ms-carousel-arrow"
                        onClick={() => { }}
                      />
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
