import React, { useEffect } from "react";
import {
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonMenuToggle,
  IonNote,
} from "@ionic/react";

import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  homeOutline,
  homeSharp,
  peopleOutline,
  peopleSharp,
  createOutline,
  createSharp,
  analyticsOutline,
  analyticsSharp,
  documentTextOutline,
  settingsOutline,
  settingsSharp,
  helpCircleOutline,
  helpCircleSharp,
  exitOutline,
  exitSharp,
  clipboardOutline,
  glassesOutline,
  chatbubbleEllipsesOutline,
  chatbubbleEllipsesSharp,
  personOutline,
  personSharp,
  calendarOutline,
  calendarSharp,
  statsChartOutline,
  statsChartSharp,
} from "ionicons/icons";
import AnimatedMascot from "./AnimatedMascot";
import { useAvatar } from "../context/AvatarContext";
import "./ProfessorSidebar.css";

interface AppPage {
  url: string;
  iosIcon: string;
  mdIcon: string;
  titleKey: string; // Changed to translation key
}

const ProfessorSidebar: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const location = useLocation();
  const { t } = useTranslation();
  const { getAvatarAssets } = useAvatar();
  const avatarAssets = getAvatarAssets();

  const appPages: AppPage[] = [
    {
      titleKey: "professor.sidebar.mainMenu",
      url: "/page/professor",
      iosIcon: homeOutline,
      mdIcon: homeSharp,
    },
    {
      titleKey: "professor.sidebar.chat",
      url: "/chat-menu",
      iosIcon: chatbubbleEllipsesOutline,
      mdIcon: chatbubbleEllipsesSharp,
    },
    {
      titleKey: "Chat with AI",
      url: "/professor-chat",
      iosIcon: chatbubbleEllipsesOutline,
      mdIcon: chatbubbleEllipsesSharp,
    },
    {
      titleKey: "professor.sidebar.students",
      url: "/prof-students",
      iosIcon: peopleOutline,
      mdIcon: peopleSharp,
    },
    {
      titleKey: "professor.sidebar.attendance",
      url: "/prof-attendance",
      iosIcon: calendarOutline,
      mdIcon: calendarSharp,
    },
    {
      titleKey: "professor.sidebar.topicStats",
      url: "/topic-stats",
      iosIcon: statsChartOutline,
      mdIcon: statsChartSharp,
    },

    {
      titleKey: "professor.sidebar.assignments",
      url: "/page/assignments-menu",
      iosIcon: clipboardOutline,
      mdIcon: clipboardOutline,
    },

    {
      titleKey: "professor.sidebar.createTask",
      url: "/page/task-assignment",
      iosIcon: clipboardOutline,
      mdIcon: clipboardOutline,
    },

    {
      titleKey: "professor.sidebar.quizLibrary",
      url: "/page/quiz-menu",
      iosIcon: documentTextOutline,
      mdIcon: documentTextOutline,
    },

    {
      titleKey: "professor.sidebar.quizGenerator",
      url: "/page/ai-quiz-generator",
      iosIcon: glassesOutline,
      mdIcon: glassesOutline,
    },

    {
      titleKey: "professor.sidebar.studentSections",
      url: "/student-section",
      iosIcon: analyticsOutline,
      mdIcon: analyticsSharp,
    },

    {
      titleKey: "professor.sidebar.createSection",
      url: "/section-creation",
      iosIcon: createOutline,
      mdIcon: createSharp,
    },
    {
      titleKey: "Live Sessions Library",
      url: "/class-library",
      iosIcon: documentTextOutline,
      mdIcon: documentTextOutline,
    },
    {
      titleKey: "Plan Live Session",
      url: "/create-class",
      iosIcon: createOutline,
      mdIcon: createSharp,
    },
    {
      titleKey: "professor.sidebar.teacherAdmin",
      url: "/teacher-admin",
      iosIcon: documentTextOutline,
      mdIcon: documentTextOutline,
    },
  ];

  const settingsPages: AppPage[] = [
    {
      titleKey: "professor.sidebar.profile",
      url: "/professor-profile",
      iosIcon: personOutline,
      mdIcon: personSharp,
    },
    {
      titleKey: "professor.sidebar.settings",
      url: "/professor-settings",
      iosIcon: settingsOutline,
      mdIcon: settingsSharp,
    },
    {
      titleKey: "professor.sidebar.help",
      url: "/folder/Help",
      iosIcon: helpCircleOutline,
      mdIcon: helpCircleSharp,
    },
    {
      titleKey: "professor.sidebar.logout",
      url: "/login",
      iosIcon: exitOutline,
      mdIcon: exitSharp,
    },
  ];

  // Get current user data from localStorage
  const getUserData = () => {
    try {
      const storedData = localStorage.getItem("userData");
      if (storedData) return JSON.parse(storedData);
    } catch (error) {
      console.error("Error parsing user data:", error);
    }
    return {
      name: "Prof. Rodriguez",
      email: "prof.rodriguez@arenai.edu",
      username: "prof.rodriguez",
    };
  };

  const currentUser = getUserData();

  const handleLogout = () => {
    console.log("ProfessorSidebar: Logging out");
    onLogout();
  };

  useEffect(() => {
    localStorage.setItem("userRole", "professor");
  }, []);

  return (
    <IonMenu contentId="main" id="professor-menu">
      <IonContent>
        {/* Header del menú - Matches Student Vertical Layout */}
        <div className="professor-menu-header">
          <div className="professor-mascot-container">
            <AnimatedMascot
              openSrc={avatarAssets.open}
              closedSrc={avatarAssets.closed}
              winkSrc={avatarAssets.wink}
              className="professor-mascot-avatar"
            />
          </div>
          <div className="teacher-info-column">
            <IonLabel className="teacher-name">{currentUser.name}</IonLabel>
            <IonNote className="teacher-email">{currentUser.email}</IonNote>
            <IonNote className="teacher-username">
              @{currentUser.username}
            </IonNote>
            <IonNote className="teacher-role">Professor</IonNote>
          </div>
        </div>

        {/* Navegación principal */}
        <IonList id="prof-main-list" lines="none">
          <IonListHeader>{t("professor.sidebar.teaching")}</IonListHeader>
          {appPages.map((appPage, index) => {
            return (
              <IonMenuToggle key={index} autoHide={false}>
                <IonItem
                  className={
                    location.pathname === appPage.url ? "selected" : ""
                  }
                  routerLink={appPage.url}
                  routerDirection="none"
                  lines="none"
                  detail={false}
                >
                  <IonIcon
                    aria-hidden="true"
                    slot="start"
                    ios={appPage.iosIcon}
                    md={appPage.mdIcon}
                  />
                  <IonLabel>{t(appPage.titleKey)}</IonLabel>
                </IonItem>
              </IonMenuToggle>
            );
          })}
        </IonList>

        {/* Configuración y ayuda */}
        <IonList id="prof-settings-list" lines="none">
          <IonListHeader>{t("professor.sidebar.account")}</IonListHeader>
          {settingsPages.map((appPage, index) => {
            // Logic for settings items
            const isLogout = appPage.url === "/login";
            return (
              <IonMenuToggle key={index} autoHide={false}>
                <IonItem
                  className={
                    location.pathname === appPage.url ? "selected" : ""
                  }
                  routerLink={appPage.url}
                  routerDirection="none"
                  lines="none"
                  detail={false}
                  onClick={isLogout ? handleLogout : undefined}
                >
                  <IonIcon
                    aria-hidden="true"
                    slot="start"
                    ios={appPage.iosIcon}
                    md={appPage.mdIcon}
                  />
                  <IonLabel>{t(appPage.titleKey)}</IonLabel>
                </IonItem>
              </IonMenuToggle>
            );
          })}
        </IonList>

        {/* Información de la app */}
        <div className="professor-menu-footer">
          <IonNote className="app-version">ArenAI v1.0.0</IonNote>
        </div>
      </IonContent>
    </IonMenu>
  );
};

export default ProfessorSidebar;
