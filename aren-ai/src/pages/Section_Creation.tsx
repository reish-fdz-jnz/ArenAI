import React, { useState } from 'react';
import {
  IonContent,
  IonPage,
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonButton
} from '@ionic/react';
import { school, create, chevronDown, todayOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import * as QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import './Section_Creation.css';
import { getApiUrl } from '../config/api';
import ProfessorHeader from '../components/ProfessorHeader';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const Section_Creation: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [gradeLevel, setGradeLevel] = useState('');
  const [sectionNumber, setSectionNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [joinLink, setJoinLink] = useState('');
  const [qrData, setQrData] = useState<{ classCode: string; joinLink: string } | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const gradeLevels = ['7', '8', '9', '10', '11', '12'];
  const sectionNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    // Validate inputs
    if (!gradeLevel) {
      setErrorMsg(t('professor.classCreation.alerts.selectGrade'));
      setIsLoading(false);
      return;
    }
    if (!sectionNumber) {
      setErrorMsg(t('professor.classCreation.alerts.selectSection'));
      setIsLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setErrorMsg(t('professor.classCreation.alerts.loginRequired'));
        setIsLoading(false);
        return;
      }

      const resp = await fetch(getApiUrl('/api/sections'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          section_number: sectionNumber,
          grade: gradeLevel
        }),
      });

      if (!resp.ok) {
        if (resp.status === 409) {
          setErrorMsg(t('professor.classCreation.alerts.exists'));
          setIsLoading(false);
          return;
        }

        const errBody = await resp.json().catch(() => null);
        setErrorMsg(errBody?.message || t('professor.classCreation.alerts.failed'));
        setIsLoading(false);
        return;
      }

      const data = await resp.json();

      const newClassCode = data.id_section?.toString() || '';
      // Use custom scheme for mobile apps so QR opens in-app instead of browser
      const newJoinLink = Capacitor.isNativePlatform()
        ? `arenai://join/${newClassCode}`
        : `${window.location.origin}/join/${newClassCode}`;

      setClassCode(newClassCode);
      setJoinLink(newJoinLink);
      setQrData({ classCode: newClassCode, joinLink: newJoinLink });

      try {
        const dataUrl = await QRCode.toDataURL(newJoinLink, { margin: 1, width: 280 });
        setQrImage(dataUrl);
      } catch (qrErr) {
        console.warn('QR generation failed', qrErr);
        setQrImage(null);
      }

      await sleep(100);
      setShowQRModal(true);

    } catch (error) {
      console.error('Create class error', error);
      setErrorMsg(t('professor.classCreation.alerts.serverError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowQRModal(false);
    setQrImage(null);
    setGradeLevel('');
    setSectionNumber('');
    setClassCode('');
    setJoinLink('');
    setQrData(null);
  };

  const handleShareClass = async () => {
    const data = qrData ?? { classCode, joinLink };
    if (!data.joinLink) {
      alert(t('professor.classCreation.alerts.noLink'));
      return;
    }
    const shareData = {
      title: `Join Grade ${gradeLevel} - Section ${sectionNumber}`,
      text: `Join my class - Grade ${gradeLevel}, Section ${sectionNumber} - code: ${data.classCode}`,
      url: data.joinLink
    };
    try {
      if ((navigator as any).share) {
        await (navigator as any).share(shareData);
      } else {
        await navigator.clipboard.writeText(`${data.joinLink}`);
        alert(t('professor.classCreation.alerts.linkCopied'));
      }
    } catch (e) {
      console.error(e);
      alert(t('professor.classCreation.alerts.shareFailed'));
    }
  };

  const handleCopyCode = async () => {
    const code = qrData?.classCode ?? classCode;
    if (!code) return;
    await navigator.clipboard.writeText(code);
    alert(t('professor.classCreation.alerts.codeCopied'));
  };

  const handleCopyLink = async () => {
    const link = qrData?.joinLink ?? joinLink;
    if (!link) return;
    await navigator.clipboard.writeText(link);
    alert(t('professor.classCreation.alerts.linkCopied'));
  };

  return (
    <IonPage className="class-creation-page">
      {/* Dynamic Background */}
      <div className="cc-background">
        <div className="cc-bg-overlay"></div>
      </div>

      {/* Header */}
      <div className="cc-header-wrapper">
        <ProfessorHeader
          pageTitle="professor.classCreation.title"
          showBackButton={true}
          onBack={() => history.goBack()}
          showNotch={false}
        />
      </div>

      {/* Main Content */}
      <IonContent fullscreen className="cc-content-wrapper">
        <div className="cc-scroll-content">
          <div className="cc-main-container">

            {/* Creation Card */}
            <div className="cc-creation-card">
              {/* Header Section */}
              <div className="cc-header-section">
                <h1 className="cc-page-title">{t('professor.classCreation.pageTitle')}</h1>
                <p className="cc-page-subtitle">{t('professor.classCreation.pageSubtitle')}</p>
              </div>

              <form className="cc-form" onSubmit={handleCreateClass}>
                {/* Error Message */}
                {errorMsg && (
                  <div className="cc-error-message">{errorMsg}</div>
                )}

                {/* Grade Level Section */}
                <div className="cc-input-section">
                  <label className="cc-input-label">{t('professor.classCreation.gradeLevel')}</label>
                  <div className="cc-select-wrapper">
                    <div className="cc-icon-wrapper grade">
                      <IonIcon icon={todayOutline} />
                    </div>
                    <IonSelect
                      value={gradeLevel}
                      placeholder={t('professor.classCreation.selectGrade')}
                      onIonChange={(e) => setGradeLevel(e.detail.value)}
                      interface="action-sheet"
                      className="cc-select"
                    >
                      {gradeLevels.map((grade, i) => (
                        <IonSelectOption key={i} value={grade}>{grade}</IonSelectOption>
                      ))}
                    </IonSelect>
                    <IonIcon icon={chevronDown} className="cc-select-arrow" />
                  </div>
                </div>

                {/* Section Number Section */}
                <div className="cc-input-section">
                  <label className="cc-input-label">{t('professor.classCreation.sectionNumber')}</label>
                  <div className="cc-select-wrapper">
                    <div className="cc-icon-wrapper section">
                      <IonIcon icon={school} />
                    </div>
                    <IonSelect
                      value={sectionNumber}
                      placeholder={t('professor.classCreation.selectSection')}
                      onIonChange={(e) => setSectionNumber(e.detail.value)}
                      interface="action-sheet"
                      className="cc-select"
                    >
                      {sectionNumbers.map((section, i) => (
                        <IonSelectOption key={i} value={section}>{section}</IonSelectOption>
                      ))}
                    </IonSelect>
                    <IonIcon icon={chevronDown} className="cc-select-arrow" />
                  </div>
                </div>

                {/* Create Button */}
                <IonButton
                  type="submit"
                  expand="block"
                  className="cc-create-button"
                  disabled={isLoading}
                >
                  <IonIcon icon={create} slot="start" />
                  {isLoading ? t('professor.classCreation.creatingBtn') : t('professor.classCreation.createBtn')}
                </IonButton>
              </form>
            </div>

            {/* Info Card */}
            <div className="cc-info-card">
              <h3 className="cc-info-title">{t('professor.classCreation.aboutTitle')}</h3>
              <ul className="cc-info-list">
                <li>{t('professor.classCreation.aboutList.step1')}</li>
                <li>{t('professor.classCreation.aboutList.step2')}</li>
                <li><strong>{t('professor.classCreation.aboutList.step3')}</strong></li>
              </ul>
            </div>

          </div>
        </div>

        {/* QR Modal Overlay - Storybook Theme */}
        {showQRModal && qrData && (
          <div className="cc-qr-overlay" role="dialog" aria-modal="true">
            <div className="cc-qr-backdrop" onClick={handleCloseModal} />
            <div className="cc-qr-card">
              <header className="cc-qr-header">
                <h3>{t('professor.classCreation.modal.title')}</h3>
                <button className="cc-qr-close" onClick={handleCloseModal} aria-label="Close">✕</button>
              </header>

              <div className="cc-qr-body">
                <p className="cc-success-message">
                  {t('professor.classCreation.modal.successMsg', { grade: gradeLevel, section: sectionNumber })}
                </p>

                <div className="cc-class-details">
                  <h4 className="cc-detail-label">{t('professor.classCreation.modal.classCode')}</h4>
                  <p className="cc-class-code">{qrData.classCode}</p>
                  <button className="cc-btn-copy" onClick={handleCopyCode}>
                    {t('professor.classCreation.modal.copy')}
                  </button>
                </div>

                <div className="cc-qr-section">
                  <h4>{t('professor.classCreation.modal.scanQr')}</h4>
                  <div className="cc-qr-code-wrapper">
                    {qrImage ? (
                      <img src={qrImage} alt="Class QR Code" width={280} height={280} />
                    ) : (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrData.joinLink)}`}
                        alt="Class QR Code (fallback)"
                        width={280}
                        height={280}
                      />
                    )}
                  </div>
                  <p className="cc-qr-link">{qrData.joinLink}</p>
                  <div className="cc-qr-actions">
                    <button className="cc-btn-share" onClick={handleShareClass}>
                      {t('professor.classCreation.modal.share')}
                    </button>
                    <button className="cc-btn-copy-link" onClick={handleCopyLink}>
                      {t('professor.classCreation.modal.copyLink')}
                    </button>
                  </div>
                  <button className="cc-btn-done" onClick={handleCloseModal}>
                    {t('professor.classCreation.modal.done')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Section_Creation;