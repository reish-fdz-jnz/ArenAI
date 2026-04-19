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
  trendingUpOutline,
  trendingDownOutline,
  analyticsOutline,
  sparklesOutline,
  calendarOutline,
  schoolOutline,
  arrowBackOutline,
  shareSocialOutline,
  bookOutline,
} from "ionicons/icons";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getApiUrl } from "../config/api";
import "./TopicDetail.css";
import PageTransition from "../components/PageTransition";
import TopicConnectionsGraph from "../components/TopicConnectionsGraph";
import StudentHeader from "../components/StudentHeader";

// ============================================================================
// TYPES & INTERFACES
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

const TopicDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
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
        const response = await fetch(getApiUrl(`api/topics/${id}`), {
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

    fetchTopicData();

    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, [id]);

  // --- HELPERS ---

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
  
  const getBadgeColorName = (score: number) => {
    if (score >= 70) return "success";
    if (score >= 40) return "warning";
    return "danger";
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
        <StudentHeader 
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
          <span className="td-score-label">{t("topicDetail.masteryLabel")}</span>
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
    <div className="td-card">
      <div className="td-card-header">
        <IonIcon icon={calendarOutline} />
        <h3 className="td-card-title">{t("topicDetail.historyTitle")}</h3>
      </div>
      <div className="td-history-list">
        {history.length > 0 ? (
          history.map((session, idx) => (
            <div key={idx} className="td-history-item">
              <div className="td-history-left">
                <span className="td-hist-date">{new Date(session.date).toLocaleDateString()}</span>
                <span className="td-hist-name">{session.class_name}</span>
              </div>
              <div 
                className="td-hist-score" 
                style={{ color: getPerformanceColor(session.score) }}
              >
                {session.score}%
                <IonIcon 
                  icon={session.score >= permanentScore ? trendingUpOutline : trendingDownOutline}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="aren-text-muted" style={{ textAlign: 'center', margin: '20px 0' }}>
            {t("topicDetail.noHistoryYet")}
          </p>
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
            onClick={() => router.push("/page/student")}
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

export default TopicDetail;
