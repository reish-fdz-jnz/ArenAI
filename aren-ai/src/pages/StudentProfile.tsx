import React, { useState } from "react";
import {
  IonPage,
  IonContent,
  IonIcon,
  useIonRouter,
  useIonViewWillEnter,
  IonAccordion,
  IonAccordionGroup,
  IonItem,
  IonLabel,
  IonModal,
} from "@ionic/react";
import {
  flame,
  trophyOutline,
  pencilOutline,
  checkmarkCircle,
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import StudentHeader from "../components/StudentHeader";
import {
  useProfilePicture,
  PROFILE_PICTURES,
} from "../context/ProfilePictureContext";
import PageTransition from "../components/PageTransition";
import "./StudentProfile.css";

import { getUserData } from "../utils/userUtils";
import { battleStatsService } from "../services/battleStats";
import { progressionService } from "../services/progressionService";
import {
  learningStatsService,
  SubjectStats,
} from "../services/learningStatsService";

const StudentProfile: React.FC = () => {
  const { t } = useTranslation();
  const router = useIonRouter();
  const { currentProfilePic, setProfilePic, getProfilePicPath } =
    useProfilePicture();
  const currentUser = getUserData();

  // Show picture picker modal
  const [showPicturePicker, setShowPicturePicker] = useState(false);

  // Real Stats State
  const [wins, setWins] = useState(0);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);

  useIonViewWillEnter(() => {
    // Load fresh stats every time page is entered
    const battleStats = battleStatsService.getStats();
    setWins(battleStats.wins);
    setStreak(battleStats.streak);

    const progStats = progressionService.getStats();
    setLevel(progStats.level);
    setXp(progStats.xp);

    const lStats = learningStatsService.getAllSubjectStats();
    setSubjectStats(lStats);
  });

  const nextLevelXp = progressionService.getNextLevelXp(level);
  const xpPercentage = xp / nextLevelXp; // Simple progress calc

  const handleDebugAddXp = () => {
    const { leveledUp, stats } = progressionService.addXp(100);
    setLevel(stats.level);
    setXp(stats.xp);
    if (leveledUp) {
      alert(`Leveled Up to ${stats.level}!`);
    }
  };

  // Find best subject
  const bestSubject = subjectStats.reduce(
    (prev, current) => (prev.mastery > current.mastery ? prev : current),
    {
      subject: "N/A",
      mastery: 0,
      averageScore: 0,
      quizzesTaken: 0,
      totalCorrect: 0,
      totalQuestionsAnswered: 0,
    },
  );

  return (
    <IonPage className="profile-page-premium">
      <StudentHeader pageTitle="studentProfile.title" showNotch={false} />
      <IonContent
        fullscreen
        className="student-page-content profile-content-premium"
      >
        <PageTransition>
          {/* HERO SECTION - Centered & Clean */}
          <div className="profile-hero-card">
            <div className="profile-bg-pattern"></div>

            <div
              className="avatar-section-centered"
              style={{ width: "160px", height: "160px" }}
            >
              <div
                className="avatar-frame-premium large"
                onClick={() => setShowPicturePicker(true)}
                style={{ width: "100%", height: "100%" }}
              >
                <img
                  src={getProfilePicPath()}
                  alt="Profile"
                  className="main-avatar-img"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "50%",
                  }}
                />
                <div
                  className="edit-icon-badge"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPicturePicker(true);
                  }}
                >
                  <IonIcon icon={pencilOutline} />
                </div>
              </div>
            </div>

            <div className="player-identity-centered">
              <h1>{currentUser.name}</h1>
              <div className="identity-subtitle">Lvl {level}</div>

              <div className="xp-progress-container">
                <div className="xp-progress-bar">
                  <div
                    className="xp-progress-fill"
                    style={{ width: `${Math.min(100, xpPercentage * 100)}%` }}
                  ></div>
                </div>
                <div className="xp-text-detail">
                  {xp} / {nextLevelXp} XP
                </div>
              </div>
            </div>

            {/* QUICK STATS BAR - Centered & Simplified */}
            <div
              className="quick-stats-scroll"
              style={{ justifyContent: "center" }}
            >
              <div className="quick-stat-item">
                <div className="qs-icon fire">
                  <IonIcon icon={flame} />
                </div>
                <div className="qs-data">
                  <span className="qs-value">{streak}</span>
                  <span className="qs-label">
                    {t("studentProfile.labels.streak")}
                  </span>
                </div>
              </div>
              <div className="quick-stat-item">
                <div className="qs-icon blue">
                  <IonIcon icon={trophyOutline} />
                </div>
                <div className="qs-data">
                  <span className="qs-value">{wins}</span>
                  <span className="qs-label">
                    {t("studentProfile.labels.wins")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-content-container">
            {/* LEARNING STATS GROUP */}

            {/* BEST SUBJECT CARD - Only show if data exists */}
            {bestSubject.quizzesTaken > 0 && (
              <div className="stats-highlight-card stat-card-gold">
                <div className="highlight-icon glass-bg">
                  {/* Icon mapping could be improved, using generic for now */}
                  <IonIcon icon={trophyOutline} />
                </div>
                <div className="highlight-info">
                  <span className="highlight-label">
                    {t("studentProfile.stats.bestSubject")}
                  </span>
                  <span className="highlight-value">{bestSubject.subject}</span>
                  <span className="highlight-sub">
                    {bestSubject.averageScore}%{" "}
                    {t("studentProfile.stats.average")}
                  </span>
                </div>
              </div>
            )}

            {/* PARENT ACCORDION - Fits "One Card" Request */}
            <IonAccordionGroup className="parent-category-accordion">
              <IonAccordion
                value="subjects-category"
                className="parent-accordion-card"
              >
                <IonItem slot="header" lines="none" className="category-header">
                  <div className="category-header-content">
                    <span className="category-title">
                      {t("studentProfile.stats.learningStats")}
                    </span>
                    <span className="category-badge">
                      {subjectStats.length}
                    </span>
                  </div>
                </IonItem>

                <div slot="content" className="category-content">
                  {/* INNER SUBJECT LIST */}
                  <IonAccordionGroup className="subject-accordion-group">
                    {subjectStats.map((stat, index) => (
                      <IonAccordion
                        key={index}
                        value={stat.subject}
                        className="subject-accordion"
                      >
                        <IonItem
                          slot="header"
                          color="light"
                          lines="none"
                          className="accordion-header-item"
                        >
                          <IonLabel>
                            <div className="ms-top-header">
                              <span className="ms-subject-title">
                                {stat.subject}
                              </span>
                              <span className="ms-score-badge">
                                {stat.mastery}%
                              </span>
                            </div>
                            <div className="mini-progress-bar">
                              <div
                                style={{
                                  width: `${stat.mastery}%`,
                                  height: "100%",
                                  background: "var(--ion-color-primary)",
                                  borderRadius: "2px",
                                }}
                              ></div>
                            </div>
                          </IonLabel>
                        </IonItem>
                        <div
                          className="ion-padding accordion-content"
                          slot="content"
                        >
                          <div className="stat-detail-row">
                            <div className="sd-item">
                              <span className="sd-label">Quizzes</span>
                              <span className="sd-value">
                                {stat.quizzesTaken}
                              </span>
                            </div>
                            <div className="sd-item">
                              <span className="sd-label">Avg. Score</span>
                              <span className="sd-value">
                                {stat.averageScore}%
                              </span>
                            </div>
                            <div className="sd-item">
                              <span className="sd-label">Total Correct</span>
                              <span className="sd-value">
                                {stat.totalCorrect}
                              </span>
                            </div>
                          </div>
                        </div>
                      </IonAccordion>
                    ))}
                  </IonAccordionGroup>
                </div>
              </IonAccordion>
            </IonAccordionGroup>
          </div>
        </PageTransition>
      </IonContent>

      {/* Profile Picture Picker Modal */}
      <IonModal
        isOpen={showPicturePicker}
        onDidDismiss={() => setShowPicturePicker(false)}
        className="profile-pic-picker-modal"
      >
        <div className="picker-modal-content">
          <h2 className="picker-modal-title">
            {t("studentProfile.choosePicture", "Elige tu foto de perfil")}
          </h2>
          <div className="picker-grid">
            {PROFILE_PICTURES.map((pic) => (
              <div
                key={pic.id}
                className={`picker-item ${currentProfilePic === pic.id ? "selected" : ""}`}
                onClick={() => {
                  setProfilePic(pic.id);
                  setShowPicturePicker(false);
                }}
              >
                <img src={pic.path} alt={pic.name} />
                {currentProfilePic === pic.id && (
                  <div className="selected-badge">
                    <IonIcon icon={checkmarkCircle} />
                  </div>
                )}
                <span className="picker-item-name">{pic.name}</span>
              </div>
            ))}
          </div>
          <button
            className="picker-close-btn"
            onClick={() => setShowPicturePicker(false)}
          >
            {t("common.cancel", "Cancelar")}
          </button>
        </div>
      </IonModal>
    </IonPage>
  );
};

export default StudentProfile;
