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
import "./StudentHeader.css";

interface StudentHeaderProps {
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
  notchContent?: React.ReactNode;
}

const StudentHeader: React.FC<StudentHeaderProps> = ({
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
  notchContent,
}) => {
  const { t } = useTranslation();

  return (
    <IonHeader className="student-header-container ion-no-border">
      <IonToolbar color="primary" className="student-toolbar ion-no-border">
        <div className="sh-content">
          {/* Menu / Back Button */}
          <IonButtons slot="start" className="sh-menu-btn-container">
            {showBackButton ? (
              <IonButton className="sh-menu-btn" onClick={onBack}>
                <IonIcon icon={arrowBack} slot="icon-only" />
              </IonButton>
            ) : (
              <IonMenuButton className="sh-menu-btn">
                <IonIcon icon={menu} />
              </IonMenuButton>
            )}
          </IonButtons>
        </div>
      </IonToolbar>

      {/* Brand / Title - Moved outside Toolbar for Z-Index control */}
      <div className="sh-brand-container-absolute">
        <div className="sh-brand-name">ArenAI</div>
        <div className="sh-brand-sub">
          {pageTitle ? t(pageTitle) : t("sidebar.student")}
        </div>
      </div>

      {/* Notch / Subject Pill - Moved outside Toolbar to avoid clipping */}
      {showNotch && (
        <div className="sh-notch-container">
          <div className="sh-notch">
            {notchContent ? (
              notchContent
            ) : showSubject ? (
              <div
                className={`sh-subject-display ${onSubjectClick ? "interactive" : ""}`}
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
                  <span className="sh-subject-text">
                    {skipTranslation
                      ? selectedSubject
                      : menuOptions
                        ? t(selectedSubject)
                        : t(getSubjectKey(selectedSubject))}
                  </span>
                )}
              </div>
            ) : (
              <div className="sh-notch-decoration"></div>
            )}
          </div>
        </div>
      )}
    </IonHeader>
  );
};

export default StudentHeader;
