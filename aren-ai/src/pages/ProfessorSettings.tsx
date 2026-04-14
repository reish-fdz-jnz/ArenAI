import React from "react";
import { useSound } from "../context/SoundContext";
import {
  IonContent,
  IonPage,
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonToggle,
} from "@ionic/react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import StudentHeader from "../components/StudentHeader"; // Can reuse or swap for a Professor Header if one exists, but StudentHeader is currently used in Prof Chat too.
import PageTransition from "../components/PageTransition";
import "./StudentSettings.css"; // Reuse student settings styles for now as they are generic

const ProfessorSettings: React.FC = () => {
  const { theme, setTheme, availableThemes, colorScheme, setColorScheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { isMuted, toggleMute } = useSound();

  const handleThemeChange = (e: CustomEvent) => {
    setTheme(e.detail.value);
  };
  const handleLanguageChange = (e: CustomEvent) => {
    const lang = e.detail.value;
    i18n.changeLanguage(lang);
  };

  return (
    <IonPage>
      {/* Reusing StudentHeader for consistency, or we could make a "ProfessorHeader" later */}
      <StudentHeader pageTitle="settings.title" showNotch={false} />

      <IonContent className="student-page-content student-settings-content">
        <PageTransition variant="fade">
          <IonList inset>
            <IonItem>
              <IonLabel>{t("settings.theme")}</IonLabel>
              <IonSelect value={theme} onIonChange={handleThemeChange}>
                {availableThemes.map((themeName) => (
                  <IonSelectOption key={themeName} value={themeName}>
                    {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonItem>
              <IonLabel>{t("settings.language")}</IonLabel>
              <IonSelect
                value={i18n.language.split("-")[0]}
                onIonChange={handleLanguageChange}
              >
                <IonSelectOption value="en">English</IonSelectOption>
                <IonSelectOption value="es">Español</IonSelectOption>
                <IonSelectOption value="zh">中文</IonSelectOption>
              </IonSelect>
            </IonItem>

            <IonItem>
              <IonLabel>{t("settings.sounds") || "Efectos de Sonido"}</IonLabel>
              <IonToggle checked={!isMuted} onIonChange={toggleMute} />
            </IonItem>

            {/* ── Dark / Light Mode Toggle ── */}
            <IonItem>
              <IonLabel>
                <h2>🌓 {t("settings.colorScheme") || "Modo de Color"}</h2>
                <p style={{ fontSize: '12px', color: 'var(--ion-text-color-step-400)' }}>
                  {colorScheme === 'dark'  ? (t("settings.forcedDark")  || "Oscuro forzado (ignora OS)") :
                   colorScheme === 'light' ? (t("settings.forcedLight") || "Claro forzado (ignora OS)") :
                                             (t("settings.autoMode")   || "Automático (sigue el OS)")}
                </p>
              </IonLabel>
              <IonSelect
                value={colorScheme}
                onIonChange={(e) => setColorScheme(e.detail.value)}
                interface="popover"
              >
                <IonSelectOption value="auto">🔄 Auto (OS)</IonSelectOption>
                <IonSelectOption value="light">☀️ Claro</IonSelectOption>
                <IonSelectOption value="dark">🌙 Oscuro</IonSelectOption>
              </IonSelect>
            </IonItem>
          </IonList>

          <div className="theme-preview-section">
            <h2>{t("settings.themePreview")}</h2>
            <p>{t("settings.previewDesc")}</p>

            <div className="preview-container">
              <h1 style={{ color: "var(--ion-color-primary)" }}>
                {t("settings.primaryTitle")}
              </h1>
              <p style={{ color: "var(--ion-text-color)" }}>
                {t("settings.standardText")}
              </p>

              <div className="button-group">
                <IonButton color="primary">
                  {t("settings.primaryButton")}
                </IonButton>
                <IonButton color="secondary">
                  {t("settings.secondaryButton")}
                </IonButton>
                <IonButton color="tertiary">
                  {t("settings.tertiaryButton")}
                </IonButton>
              </div>

              <IonCard color="primary">
                <IonCardHeader>
                  <IonCardTitle>{t("settings.primaryCard")}</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>{t("settings.cardDesc")}</IonCardContent>
              </IonCard>
            </div>
          </div>
        </PageTransition>
      </IonContent>
    </IonPage>
  );
};

export default ProfessorSettings;
