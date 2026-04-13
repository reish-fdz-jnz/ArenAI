import React, { useState, useEffect, useRef } from "react";
import { IonIcon } from "@ionic/react";
import { chevronBack, chevronForward, close } from "ionicons/icons";
import { useTranslation } from "react-i18next";
import "./CalendarSelector.css";

interface CalendarSelectorProps {
  onDateSelect?: (date: Date) => void;
  onSubjectSelect?: (subject: string, date: Date) => void;
  title?: string;
  subjects?: string[];
  selectedSubject?: string;
}

const CalendarSelector: React.FC<CalendarSelectorProps> = ({
  onDateSelect,
  onSubjectSelect,
  title = "Class Schedule",
  subjects = [],
  selectedSubject,
}) => {
  const { t, i18n } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    generateWeek(currentDate);
  }, [currentDate]);

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowSubjectPicker(false);
      }
    };
    if (showSubjectPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSubjectPicker]);

  const generateWeek = (baseDate: Date) => {
    const startOfWeek = new Date(baseDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      week.push(d);
    }
    setWeekDates(week);
  };

  const handlePrevWeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
    setShowSubjectPicker(false);
  };

  const handleNextWeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
    setShowSubjectPicker(false);
  };

  const handleDateClick = (date: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedDate(date);
    if (onDateSelect) {
      onDateSelect(date);
    }
    // Show subject picker if subjects are available
    if (subjects.length > 0) {
      setShowSubjectPicker(true);
    }
  };

  const handleSubjectClick = (subject: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowSubjectPicker(false);
    if (onSubjectSelect) {
      onSubjectSelect(subject, selectedDate);
    }
  };

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString(i18n.language, {
      month: "long",
      year: "numeric",
    });
  };

  const formatSelectedDate = (date: Date) => {
    return date.toLocaleDateString(i18n.language, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const days = [
    t("calendar.sun", "Dom"),
    t("calendar.mon", "Lun"),
    t("calendar.tue", "Mar"),
    t("calendar.wed", "Mié"),
    t("calendar.thu", "Jue"),
    t("calendar.fri", "Vie"),
    t("calendar.sat", "Sáb"),
  ];

  // Subject icons mapping
  const getSubjectIcon = (subject: string): string => {
    const icons: Record<string, string> = {
      Math: "📐",
      Science: "🔬",
      "Social Studies": "🌍",
      Spanish: "📖",
      English: "🔤",
      History: "📜",
      Art: "🎨",
      Music: "🎵",
      PE: "⚽",
    };
    return icons[subject] || "📚";
  };

  return (
    <div className="calendar-selector-container" ref={pickerRef}>
      {/* Top Header: Title */}
      <div className="cs-top-header">
        <div className="cs-subject-pill">{title}</div>
      </div>

      {/* Month Navigation */}
      <div className="cs-month-nav">
        <div className="cs-nav-btn" onClick={handlePrevWeek}>
          <IonIcon icon={chevronBack} />
        </div>
        <span className="cs-month-year">{formatMonthYear(currentDate)}</span>
        <div className="cs-nav-btn" onClick={handleNextWeek}>
          <IonIcon icon={chevronForward} />
        </div>
      </div>

      {/* Calendar Body */}
      <div className="cs-body">
        <div className="cs-days-row">
          {days.map((day) => (
            <div key={day} className="cs-day-label">
              {day}
            </div>
          ))}
        </div>
        <div className="cs-dates-row">
          {weekDates.map((date, index) => (
            <div
              key={index}
              className={`cs-date-cell ${isSelected(date) ? "selected" : ""} ${isToday(date) ? "today" : ""}`}
              onClick={(e) => handleDateClick(date, e)}
            >
              {date.getDate()}
              {isToday(date) && !isSelected(date) && (
                <div className="cs-today-dot"></div>
              )}
              {isSelected(date) && <div className="cs-dot"></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Subject Picker — slides in when a date is clicked */}
      {showSubjectPicker && subjects.length > 0 && (
        <div className="cs-subject-picker">
          <div className="cs-picker-header">
            <span className="cs-picker-date">{formatSelectedDate(selectedDate)}</span>
            <div
              className="cs-picker-close"
              onClick={() => setShowSubjectPicker(false)}
            >
              <IonIcon icon={close} />
            </div>
          </div>
          <div className="cs-picker-label">
            {t("calendar.selectSubject", "Elige una materia:")}
          </div>
          <div className="cs-subject-grid">
            {subjects.map((subject) => (
              <div
                key={subject}
                className={`cs-subject-chip ${selectedSubject === subject ? "active" : ""}`}
                onClick={(e) => handleSubjectClick(subject, e)}
              >
                <span className="cs-chip-icon">{getSubjectIcon(subject)}</span>
                <span className="cs-chip-label">{t(`subjects.${subject.toLowerCase().replace(/\s+/g, '')}`, subject)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export { CalendarSelector };
