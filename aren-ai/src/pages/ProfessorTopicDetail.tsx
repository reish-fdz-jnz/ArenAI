import React, { useState, useEffect, useRef } from "react";
import {
  IonContent,
  IonPage,
  IonIcon,
  IonSpinner,
  useIonRouter,
  IonFooter,
} from "@ionic/react";
import {
  analyticsOutline,
  calendarOutline,
  schoolOutline,
  shareSocialOutline,
} from "ionicons/icons";
import { useParams, useLocation } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from "react-i18next";
import { getApiUrl } from "../config/api";
import "./TopicDetail.css"; // Reuse same CSS for 1-to-1 parity
import PageTransition from "../components/PageTransition";
import TopicConnectionsGraph from "../components/TopicConnectionsGraph";
import ProfessorHeader from "../components/ProfessorHeader";

// ============================================================================
// TYPES & INTERFACES (Matching Student 1-to-1)
// ============================================================================

interface TopicRelation {
  id_topic: number;
  name: string;
  type: "father" | "son";
  correlation_coefficient: number | null;
  score: number | null;
}

interface ClassPerformance {
  id_class: number;
  class_name: string;
  score: number;
  date: string;
}

interface TopicMasteryProfile {
  id_topic: number;
  name: string;
  description: string;
  subject_name: string;
  permanent_score: number;
  ai_summary: string | null;
  relations: TopicRelation[];
  history: ClassPerformance[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ProfessorTopicDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const grade = queryParams.get("grade");
  const sectionNumber = queryParams.get("section");
  
  const { t } = useTranslation();
  const router = useIonRouter();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TopicMasteryProfile | null>(null);

  // Typing animation state
  const [displayedSummary, setDisplayedSummary] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchTopicData = async () => {
      try {
        const token = localStorage.getItem("authToken");
        
        // Use URL params first, fallback to localStorage
        const activeGrade = grade || localStorage.getItem("professor_selected_grade");
        const activeSection = sectionNumber || localStorage.getItem("professor_selected_section");
        
        if (!activeGrade || !activeSection) {
          console.warn("[ProfessorTopicDetail] Missing grade or section context");
          setLoading(false);
          return;
        }

        // Pulling class-level data using grade and section
        const url = getApiUrl(`api/topics/class/${id}?grade=${activeGrade}&sectionNumber=${activeSection}`);
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setProfile(data);
          
          if (data.ai_summary) {
            startTypingAnimation(data.ai_summary);
          }
        }
      } catch (err) {
        console.error("Error fetching topic profile:", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchTopicData();
    }

    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, [id, grade, sectionNumber]);

  // --- HELPERS (Carbon Copy of Student) ---

  const startTypingAnimation = (text: string) => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    setDisplayedSummary("");
    setIsTyping(true);
    let charIndex = 0;

    typingIntervalRef.current = setInterval(() => {
      if (charIndex < text.length) {
        setDisplayedSummary(text.substring(0, charIndex + 1));
        charIndex++;
      } else {
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        setIsTyping(false);
      }
    }, 20);
  };
  
  const getPerformanceColor = (score: number) => {
    if (score >= 70) return "var(--ion-color-success)";
    if (score >= 40) return "var(--ion-color-warning)";
    return "var(--ion-color-danger)";
  };

  // --- SUB-RENDERS ---

  const renderHeader = () => {
    if (!profile?.name) return null;
    return (
      <div className="td-header-wrapper">
        <ProfessorHeader 
          pageTitle="topicDetail.title"
          showSubject={true}
          selectedSubject={profile?.name || ""}
          skipTranslation={true}
          showBackButton={false}
        />
      </div>
    );
  };

  const renderMasteryHero = (score: number) => {
    const color = getPerformanceColor(score);
    return (
      <div className="td-hero-section">
        <div 
          className="ms-progress-circle-large"
          style={{ 
            borderColor: color,
            color: 'white',
          }}
        >
          {Math.round(score)}%
        </div>
      </div>
    );
  };

  const renderDescription = (description: string) => (
    <div className="td-card">
      <div className="td-card-header">
        <IonIcon icon={schoolOutline} />
        <h3 className="td-card-title">{t("topicDetail.descriptionTitle")}</h3>
      </div>
      <p className="td-insight-text">
        {description || t("common.noData")}
      </p>
    </div>
  );

  const renderInsightCard = () => (
    <div className="td-card">
      <div className="td-card-header">
        <IonIcon icon={analyticsOutline} />
        <h3 className="td-card-title">{t("topicDetail.insightTitle")}</h3>
      </div>
      <p className="td-insight-text">
        {displayedSummary || (loading ? "..." : t("topicDetail.insightPlaceholder"))}
        {isTyping && <span className="td-cursor" />}
      </p>
    </div>
  );

  const renderHistory = (history: ClassPerformance[], permanentScore: number) => (
    <div className="td-card td-history-card">
      <div className="td-card-header">
        <IonIcon icon={calendarOutline} />
        <h3 className="td-card-title">{t("topicDetail.historyTitle")}</h3>
      </div>
      <div className="td-history-graph-container">
        {history.length >= 1 ? (
          <div style={{ width: '100%', height: 220, marginTop: '15px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                ...([...history].reverse().map(h => ({
                  name: new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                  score: Math.round(h.score)
                }))),
                { 
                  name: t("topicDetail.nowLabel"), 
                  score: Math.round(permanentScore) 
                }
              ]}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#78B8B0" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#78B8B0" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--ion-text-color)', fontSize: 10, opacity: 0.6 }}
                  dy={10}
                />
                <YAxis 
                  domain={[0, 100]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--ion-text-color)', fontSize: 10, opacity: 0.6 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(30, 30, 30, 0.9)', 
                    border: 'none', 
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    color: '#fff'
                  }}
                  itemStyle={{ color: '#78B8B0', fontWeight: 'bold' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#78B8B0" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorScore)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="td-not-enough-data">
             <IonIcon icon={analyticsOutline} style={{ fontSize: '32px', opacity: 0.5, marginBottom: '12px' }} />
             <p className="aren-text-muted">
               {t("topicDetail.notEnoughData", "Not enough historical data available yet.")}
             </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderConnections = () => (
    <div className="td-card td-graph-card">
      <div className="td-card-header" style={{ paddingLeft: '14px' }}>
        <IonIcon icon={shareSocialOutline} />
        <h3 className="td-card-title">{t("topicDetail.connectionsTitle")}</h3>
      </div>
      <TopicConnectionsGraph 
        heroName={profile?.name || ""} 
        heroScore={profile?.permanent_score || 0}
        relations={profile?.relations || []}
      />
    </div>
  );

  const renderEmptyState = () => (
    <div className="td-card td-empty-state">
      <div style={{ background: 'var(--ion-color-secondary-soft)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
        <IonIcon icon={schoolOutline} style={{ fontSize: '40px', color: 'var(--ion-color-primary)' }} />
      </div>
      <h3 style={{ margin: 0, fontWeight: 800 }}>{t("topicDetail.emptyStateTitle")}</h3>
      <p style={{ opacity: 0.7, fontSize: '0.9rem', marginTop: '8px' }}>{t("topicDetail.emptyStateDesc")}</p>
    </div>
  );

  // --- MAIN RENDER ---

  if (loading) {
    return (
      <IonPage>
        <div className="td-loading-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
          <IonSpinner name="crescent" color="primary" />
          <p className="aren-text-muted">{t("topicDetail.loading")}</p>
        </div>
      </IonPage>
    );
  }

  if (!profile) {
    return (
      <IonPage>
        <div className="td-error-state" style={{ padding: '40px', textAlign: 'center' }}>
          <h2 className="aren-text-muted">{t("topicDetail.error")}</h2>
        </div>
      </IonPage>
    );
  }

  const hasExperience = (profile.history?.length > 0) || (profile.permanent_score > 0);

  return (
    <PageTransition>
      <IonPage className="topic-profile-page">
        <IonContent fullscreen className="td-main-content">
          {renderHeader()}
          
          <div className="td-scroll-container">
            {!hasExperience ? (
              renderEmptyState()
            ) : (
              <>
                {renderMasteryHero(profile.permanent_score)}
                {renderDescription(profile.description)}
                {renderInsightCard()}
                {renderConnections()}
                {renderHistory(profile.history || [], profile.permanent_score)}
                <div className="quiz-footer-spacer" />
              </>
            )}
          </div>
      </IonContent>

      <IonFooter className="quiz-footer">
        <div className="quiz-footer-notch">
          <button 
            className="quiz-generate-btn"
            onClick={() => router.push("/page/professor")}
            style={{ background: 'var(--ion-color-secondary)' }}
          >
            {t("common.back") || "Return to Menu"}
          </button>
        </div>
      </IonFooter>
    </IonPage>
  </PageTransition>
);
};

export default ProfessorTopicDetail;
