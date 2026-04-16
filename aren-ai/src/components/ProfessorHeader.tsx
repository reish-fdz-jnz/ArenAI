import React from "react";
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonIcon,
} from "@ionic/react";
import { menu, arrowBack } from "ionicons/icons";
import { useTranslation } from "react-i18next";
import StudentMenu from "./StudentMenu";
import { getSubjectKey } from "../utils/subjectUtils";
import "./ProfessorHeader.css";

interface ProfessorHeaderProps {
  pageTitle?: string;
  showSubject?: boolean;
  selectedSubject?: string;
  onSubjectChange?: (subject: string) => void;
  menuOptions?: string[];
  showNotch?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  skipTranslation?: boolean;
  onSubjectClick?: () => void;
}

const ProfessorHeader: React.FC<ProfessorHeaderProps> = ({
  pageTitle,
  showSubject = false,
  selectedSubject = "Math",
  onSubjectChange,
  menuOptions,
  showNotch = true,
  showBackButton = false,
  onBack,
  skipTranslation = false,
  onSubjectClick,
}) => {
  const { t } = useTranslation();

  return (
    <IonHeader className="professor-header-container ion-no-border">
      <IonToolbar color="primary" className="professor-toolbar ion-no-border">
        <div className="ph-content">
          {/* Menu / Back Button */}
          <IonButtons slot="start" className="ph-menu-btn-container">
            {showBackButton ? (
              <IonButton className="ph-menu-btn" onClick={onBack}>
                <IonIcon icon={arrowBack} slot="icon-only" />
              </IonButton>
            ) : (
              <IonMenuButton className="ph-menu-btn">
                <IonIcon icon={menu} />
              </IonMenuButton>
            )}
          </IonButtons>
        </div>
      </IonToolbar>

      {/* Brand / Title - Moved outside Toolbar for Z-Index control */}
      <div className="ph-brand-container-absolute">
        <div className="ph-brand-name">ArenAI</div>
        <div className="ph-brand-sub">
          {pageTitle ? t(pageTitle) : t("professor.sidebar.teaching")}
        </div>
      </div>

      {/* Notch / Subject Pill - Moved outside Toolbar to avoid clipping */}
      {showNotch && (
        <div className="ph-notch-container">
          <div className="ph-notch">
            {showSubject ? (
              <div
                className={`ph-subject-display ${
                  onSubjectClick ? "interactive" : ""
                }`}
                onClick={onSubjectClick}
              >
                {onSubjectChange ? (
                  <StudentMenu
                    selectedSubject={
                      skipTranslation
                        ? selectedSubject
                        : menuOptions
                        ? t(selectedSubject)
                        : t(getSubjectKey(selectedSubject))
                    }
                    onSubjectChange={onSubjectChange}
                    variant="header"
                    options={
                      menuOptions
                        ? menuOptions.map((opt) => ({
                            value: opt,
                            label: t(opt),
                          }))
                        : undefined
                    }
                  />
                ) : (
                  <span className="ph-subject-text">
                    {skipTranslation
                      ? selectedSubject
                      : menuOptions
                      ? t(selectedSubject)
                      : t(getSubjectKey(selectedSubject))}
                  </span>
                )}
              </div>
            ) : (
              <div className="ph-notch-decoration"></div>
            )}
          </div>
        </div>
      )}
    </IonHeader>
  );
};

export default ProfessorHeader;
