import React, { useState } from 'react';
import {
    IonModal,
    IonContent,
    IonButton,
    IonIcon
} from '@ionic/react';
import { checkmarkCircle } from 'ionicons/icons';
import { useTheme, Theme, THEME_REGISTRY } from '../context/ThemeContext';
import './ThemeSelectionModal.css';

interface ThemeSelectionModalProps {
    isOpen: boolean;
    onDismiss: () => void;
    onThemeSelected: (theme: Theme) => void;
}

const ThemeSelectionModal: React.FC<ThemeSelectionModalProps> = ({
    isOpen,
    onDismiss,
    onThemeSelected
}) => {
    const { setTheme, getThemeInfo } = useTheme();
    const [selectedTheme, setSelectedTheme] = useState<Theme>('original');

    const handleConfirm = () => {
        setTheme(selectedTheme);
        onThemeSelected(selectedTheme);
    };

    const handleSelect = (theme: Theme) => {
        setSelectedTheme(theme);
        setTheme(theme); // Live preview
    };

    const selectedInfo = getThemeInfo(selectedTheme);

    return (
        <IonModal
            isOpen={isOpen}
            className="theme-selection-modal"
            backdropDismiss={false}
        >
            <IonContent>
                <div className="theme-modal-content">
                    <div className="theme-modal-header">
                        <h2 className="theme-modal-title">Welcome to Aren AI!</h2>
                        <p className="theme-modal-subtitle">Choose a theme to personalize your experience</p>
                    </div>

                    <div className="theme-grid">
                        {THEME_REGISTRY.map((themeInfo) => (
                            <div
                                key={themeInfo.id}
                                className={`theme-card ${selectedTheme === themeInfo.id ? 'selected' : ''}`}
                                onClick={() => handleSelect(themeInfo.id)}
                            >
                                <div className={`theme-preview-box theme-preview-${themeInfo.id}`}>
                                    <span className="theme-preview-emoji">{themeInfo.emoji}</span>
                                </div>
                                <p className="theme-name">{themeInfo.displayName}</p>
                            </div>
                        ))}
                    </div>

                    <div className="theme-modal-footer">
                        <IonButton
                            expand="block"
                            className="select-button"
                            onClick={handleConfirm}
                        >
                            Continue with {selectedInfo?.displayName || selectedTheme}
                            <IonIcon slot="end" icon={checkmarkCircle} />
                        </IonButton>
                    </div>
                </div>
            </IonContent>
        </IonModal>
    );
};

export default ThemeSelectionModal;
