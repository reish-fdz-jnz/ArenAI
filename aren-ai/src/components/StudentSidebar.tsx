import React, { useEffect, useState } from "react";
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
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  homeOutline,
  homeSharp,
  schoolOutline,
  schoolSharp,
  bookOutline,
  bookSharp,
  calendarOutline,
  calendarSharp,
  trophyOutline,
  trophySharp,
  ribbon,
  ribbonOutline,
  ribbonSharp,
  happyOutline,
  happySharp,
  cartOutline,
  cartSharp,
  settingsOutline,
  settingsSharp,
  helpCircleOutline,
  helpCircleSharp,
  exitOutline,
  exitSharp,
  peopleOutline,
  peopleSharp,
  analyticsOutline,
  timeOutline,
  americanFootballOutline,
  americanFootballSharp,
  personOutline,
  personSharp,
} from "ionicons/icons";
import { AppPage } from "../types/user";
import { getUserData } from "../utils/userUtils";
import { useProfilePicture } from "../context/ProfilePictureContext";
import "./StudentSidebar.css";

const appPages: AppPage[] = [
  {
    titleKey: "sidebar.mainMenu",
    url: "/page/student",
    iosIcon: homeOutline,
    mdIcon: homeSharp,
  },
  {
    titleKey: "sidebar.assignments",
    url: "/student-assignments",
    iosIcon: bookOutline,
    mdIcon: bookSharp,
  },

  {
    titleKey: "sidebar.chat",
    url: "/chat",
    iosIcon: schoolOutline,
    mdIcon: schoolSharp,
  },
  {
    titleKey: "sidebar.social",
    url: "/chat-menu",
    iosIcon: peopleOutline,
    mdIcon: peopleSharp,
  },
  {
    titleKey: "sidebar.quiz",
    url: "/quiz-menu",
    iosIcon: trophyOutline,
    mdIcon: trophySharp,
  },
  {
    titleKey: "sidebar.personalityQuiz",
    url: "/personality-quiz",
    iosIcon: happyOutline,
    mdIcon: happySharp,
  },
  /*
  {
    titleKey: "sidebar.leaderboard",
    url: "/leaderboard",
    iosIcon: ribbonOutline,
    mdIcon: ribbonSharp,
  },
  */
  {
    titleKey: "sidebar.battle",
    url: "/battlelobby",
    iosIcon: americanFootballOutline,
    mdIcon: americanFootballSharp,
  },
];

const settingsPages: AppPage[] = [
  {
    titleKey: "Æ",
    url: "/aren-entity",
    iosIcon: personOutline,
    mdIcon: personSharp,
  },
  {
    titleKey: "sidebar.settings",
    url: "/settings",
    iosIcon: settingsOutline,
    mdIcon: settingsSharp,
  },
  {
    titleKey: "sidebar.help",
    url: "/help",
    iosIcon: helpCircleOutline,
    mdIcon: helpCircleSharp,
  },
  {
    titleKey: "sidebar.logout",
    url: "/login",
    iosIcon: exitOutline,
    mdIcon: exitSharp,
  },
];

// Props interface for the sidebar
interface StudentSidebarProps {
  onLogout: () => void;
}

// Cálculo simplificado del índice de utilización
function calcularIndiceUtilizacion({
  tiempoDeUso,
  actividadesCompletadas,
}: {
  tiempoDeUso: number;
  actividadesCompletadas: number;
}) {
  const usoLog = Math.log1p(tiempoDeUso) * 15;
  const actividadesPeso = Math.pow(actividadesCompletadas, 1.5) * 6;
  const bonus =
    (tiempoDeUso > 60 ? 10 : 0) + (actividadesCompletadas >= 5 ? 8 : 0);
  return Math.round(usoLog + actividadesPeso + bonus);
}

const META_DIARIA = 100;

const StudentSidebar: React.FC<StudentSidebarProps> = ({ onLogout }) => {
  const { t } = useTranslation();
  const { getProfilePicPath } = useProfilePicture();

  const [showAnimation, setShowAnimation] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Solo muestra la animación la primera vez
    const timer = setTimeout(() => setShowAnimation(false), 1000); // duración de la animación
    return () => clearTimeout(timer);
  }, []);

  const currentUser = getUserData();

  // Handle logout
  const handleLogout = () => {
    console.log("StudentSidebar: Logging out");
    onLogout(); // Call the parent's logout function
  };

  // --- NUEVO: Estados para uso e índice ---
  const [tiempoDeUso, setTiempoDeUso] = useState<number>(0); // en minutos
  const [actividadesCompletadas, setActividadesCompletadas] =
    useState<number>(0);

  // Simulación de otros factores (quemado)
  const otrosFactores = 10;

  // Simulación: incrementar tiempo de uso cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setTiempoDeUso((prev) => prev + 1);
    }, 60000); // cada minuto
    return () => clearInterval(interval);
  }, []);

  // Simulación: actividades completadas (puedes cambiarlo por datos reales)
  useEffect(() => {
    setActividadesCompletadas(3); // valor quemado
  }, []);

  // Cálculo del índice de utilización usando la función determinista
  const indiceUtilizacion = calcularIndiceUtilizacion({
    tiempoDeUso,
    actividadesCompletadas,
  });

  // Cálculo del porcentaje de progreso
  const progreso = Math.min(
    100,
    Math.round((indiceUtilizacion / META_DIARIA) * 100),
  );
  // Estado para mostrar la ventanita de explicación
  const [showFormulaInfo, setShowFormulaInfo] = useState(false);

  return (
    <IonMenu
      contentId="main"
      id="student-menu"
      style={{
        '--background': 'var(--ion-background-color, #e8dfc8)',
      } as React.CSSProperties}
    >
      <IonContent
        style={{
          '--background': 'var(--ion-background-color, #e8dfc8)',
        } as React.CSSProperties}
      >
        {/* Header del menú */}
        <div className="student-menu-header">
          <div
            className="sidebar-mascot-wrapper"
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "5px",
              marginLeft: "0",
            }}
          >
            <img
              src={getProfilePicPath()}
              alt="Profile"
              className="sidebar-mascot-img"
              style={{
                width: "100px",
                height: "100px",
                objectFit: "cover",
                borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.3)",
              }}
            />
          </div>
          <div className="student-info">
            <div className="student-details">
              <IonLabel className="student-name">{currentUser.name}</IonLabel>
              <IonNote className="student-email">{currentUser.email}</IonNote>
              <IonNote className="student-username">
                @{currentUser.username}
              </IonNote>
              <Link
                to="/profile"
                className="sidebar-profile-btn"
                onClick={() => {
                  const menu = document.querySelector('ion-menu');
                  menu?.close();
                }}
              >
                Ver perfil →
              </Link>
            </div>
          </div>
        </div>

        {/* Navegación principal */}
        <IonList id="main-list" lines="none">
          <IonListHeader>{t("sidebar.learning")}</IonListHeader>
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
        <IonList id="settings-list" lines="none">
          <IonListHeader>{t("sidebar.account")}</IonListHeader>
          {settingsPages.map((appPage, index) => {
            if (appPage.titleKey === "sidebar.logout") {
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
                    onClick={handleLogout}
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
            }

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

        {/* --- NUEVO: Indicadores de uso --- */}
        <div className="sidebar-usage-info">
          <div className="usage-row">
            <IonIcon icon={analyticsOutline} className="usage-icon" />
            <span className="usage-label">{t("sidebar.utilizationIndex")}</span>
            <span className="usage-value">{indiceUtilizacion}</span>
            <button
              className="usage-help-btn"
              aria-label={t("sidebar.howCalculated")}
              onClick={() => setShowFormulaInfo(true)}
              tabIndex={0}
            >
              <IonIcon icon={helpCircleOutline} />
            </button>
          </div>
          <div className="usage-progress-bar">
            <div
              className="usage-progress-inner"
              style={{ width: `${progreso}%` }}
            />
          </div>
          <div className="usage-progress-label"></div>
          <div className="usage-row">
            <IonIcon icon={timeOutline} className="usage-icon" />
            <span className="usage-label">{t("sidebar.timeUsed")}</span>
            <span className="usage-value">{tiempoDeUso} min</span>
          </div>
          {showFormulaInfo && (
            <div
              className="usage-formula-tooltip"
              onClick={() => setShowFormulaInfo(false)}
            >
              <strong>{t("sidebar.formulaTitle")}</strong>
              <div>
                {t("sidebar.formulaBody")}
                <br />
                <br />
                <b>{t("sidebar.formulaBonus")}</b>
                <br />
                <b>{t("sidebar.formulaGoal", { goal: META_DIARIA })}</b>
                <br />
                <b>{t("sidebar.formulaProgress")}</b>
              </div>
              <div className="usage-formula-close">{t("sidebar.close")}</div>
            </div>
          )}
        </div>

        {/* Información de la app */}
        <div className="student-menu-footer">
          <IonNote className="app-version">ArenAI v1.0.0</IonNote>
        </div>
      </IonContent>
    </IonMenu>
  );
};

export default StudentSidebar;
