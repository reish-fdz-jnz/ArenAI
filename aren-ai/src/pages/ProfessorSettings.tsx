import React from "react";
import { useSound } from "../context/SoundContext";
import {
  IonContent,
  IonPage,
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
  IonIcon,
} from "@ionic/react";
import { 
  colorPaletteOutline, 
  languageOutline, 
  volumeHighOutline, 
  contrastOutline,
  eyeOutline,
  sparklesOutline
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import StudentHeader from "../components/StudentHeader";
import PageTransition from "../components/PageTransition";
import { useHistory } from "react-router-dom";
import "./ProfessorSettings.css";

const ProfessorSettings: React.FC = () => {
  const history = useHistory();
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
    <IonPage className="prof-settings-page">
      <StudentHeader pageTitle="settings.title" showNotch={false} showBackButton={true} onBack={() => history.goBack()} />

      <IonContent className="prof-settings-content" fullscreen>
        <PageTransition variant="fade">
          <div className="settings-container">
            
            {/* --- APARIENCIA --- */}
            <div className="settings-section-header">
              <h3>
                <IonIcon icon={colorPaletteOutline} />
                {t("professor.profile.appearance") || "Apariencia"}
              </h3>
            </div>

            <div className="settings-glass-card">
              <IonItem lines="full" className="settings-item-premium">
                <IonIcon icon={sparklesOutline} slot="start" />
                <IonLabel>{t("settings.theme") || "Tema Visual"}</IonLabel>
                <IonSelect value={theme} onIonChange={handleThemeChange} className="select-premium" interface="popover">
                  {availableThemes.map((themeName) => (
                    <IonSelectOption key={themeName} value={themeName}>
                      {themeName === 'original-alter' ? 'Original (ALTER)' : themeName.charAt(0).toUpperCase() + themeName.slice(1)}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              <IonItem lines="none" className="settings-item-premium">
                <IonIcon icon={contrastOutline} slot="start" />
                <IonLabel>
                  {t("settings.colorScheme") || "Modo de Pantalla"}
                  <p style={{ fontSize: '11px', fontWeight: 500, marginTop: '4px' }}>
                    {colorScheme === 'dark'  ? (t("settings.forcedDark")  || "Oscuro fijo") :
                     colorScheme === 'light' ? (t("settings.forcedLight") || "Claro fijo") :
                                               (t("settings.autoMode")   || "Automático (Sigue al sistema)")}
                  </p>
                </IonLabel>
                <IonSelect
                  value={colorScheme}
                  onIonChange={(e) => setColorScheme(e.detail.value)}
                  interface="popover"
                  className="select-premium"
                >
                  <IonSelectOption value="auto">🔄 Auto (OS)</IonSelectOption>
                  <IonSelectOption value="light">☀️ Claro</IonSelectOption>
                  <IonSelectOption value="dark">🌙 Oscuro</IonSelectOption>
                </IonSelect>
              </IonItem>
            </div>

            {/* --- GENERAL --- */}
            <div className="settings-section-header">
              <h3>
                <IonIcon icon={languageOutline} />
                {t("settings.general") || "General"}
              </h3>
            </div>

            <div className="settings-glass-card">
              <IonItem lines="full" className="settings-item-premium">
                <IonIcon icon={languageOutline} slot="start" />
                <IonLabel>{t("settings.language") || "Idioma de Interfaz"}</IonLabel>
                <IonSelect
                  value={i18n.language.split("-")[0]}
                  onIonChange={handleLanguageChange}
                  className="select-premium"
                  interface="popover"
                >
                  <IonSelectOption value="en">English</IonSelectOption>
                  <IonSelectOption value="es">Español</IonSelectOption>
                  <IonSelectOption value="zh">中文</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem lines="none" className="settings-item-premium">
                <IonIcon icon={volumeHighOutline} slot="start" />
                <IonLabel>{t("settings.sounds") || "Efectos de Sonido"}</IonLabel>
                <IonToggle checked={!isMuted} onIonChange={toggleMute} color="secondary" />
              </IonItem>
            </div>

            {/* --- VISTA PREVIA --- */}
            <div className="preview-card-premium">
              <div className="preview-title-modern">
                <IonIcon icon={eyeOutline} style={{ fontSize: '24px', verticalAlign: 'middle', marginRight: '10px', color: 'var(--ion-color-primary)' }} />
                {t("settings.themePreview") || "Vista Previa"}
              </div>
              <p className="preview-subtitle-modern">
                {t("settings.previewDesc") || "Observa cómo se aplican tus colores favoritos a los componentes de ArenAI en tiempo real."}
              </p>

              <div className="preview-mini-dashboard">
                <div className="preview-text-sample">
                  <h4 style={{ margin: '0 0 5px 0', fontWeight: 800, color: 'var(--ion-color-primary)' }}>
                    {t("settings.primaryTitle") || "Título de Ejemplo"}
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', opacity: 0.8 }}>
                    {t("settings.standardText") || "Este es un ejemplo de cómo se verá el texto descriptivo en tus tarjetas."}
                  </p>
                </div>

                <div className="preview-btn-row">
                  <IonButton color="primary" size="small">Primario</IonButton>
                  <IonButton color="secondary" size="small">Secundario</IonButton>
                  <IonButton color="tertiary" size="small">Terciario</IonButton>
                </div>

                <IonCard color="primary" style={{ margin: 0, borderRadius: '16px', boxShadow: '0 4px 15px rgba(var(--ion-color-primary-rgb), 0.3)' }}>
                  <IonCardHeader style={{ padding: '12px 16px' }}>
                    <IonCardTitle style={{ fontSize: '14px', fontWeight: 800 }}>Muestra de Tarjeta</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent style={{ padding: '0 16px 12px 16px', fontSize: '12px' }}>
                    Los elementos destacados usarán este contraste.
                  </IonCardContent>
                </IonCard>
              </div>
            </div>

          </div>
        </PageTransition>
      </IonContent>
    </IonPage>
  );
};

export default ProfessorSettings;
