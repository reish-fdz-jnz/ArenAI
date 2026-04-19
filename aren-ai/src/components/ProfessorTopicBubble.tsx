import React from 'react';
import { useIonRouter } from '@ionic/react';
import { useAnimatedScore } from '../hooks/useAnimatedScore';
import { TopicProgress } from '../types/student';

interface ProfessorTopicBubbleProps {
  topic: TopicProgress;
  index: number;
  getColorForPercentage: (p: number) => string;
  expandedTopic: string | null;
  setExpandedTopic: (val: string | null) => void;
  selectedSubject: string;
  selectedGrade: number | string;
  selectedSection: string;
}

/**
 * Isolated version of TopicBubble for Professors.
 * decoupled from student logic to prevent routing/redirect issues.
 */
export const ProfessorTopicBubble: React.FC<ProfessorTopicBubbleProps> = ({
  topic,
  index,
  getColorForPercentage,
  expandedTopic,
  setExpandedTopic,
  selectedSubject,
  selectedGrade,
  selectedSection
}) => {
  const router = useIonRouter();
  const animatedPercentage = useAnimatedScore(topic.percentage);
  const hasData = topic.id && animatedPercentage !== null;
  
  const performanceColor = hasData 
    ? getColorForPercentage(animatedPercentage!) 
    : "rgba(255, 255, 255, 0.15)";

  const labelKey = `${index}-${topic.name}`;

  const handleBubbleClick = () => {
    if (topic.id) {
        // Direct navigation to professor detail page
        router.push(`/page/class-topic/${topic.id}?grade=${selectedGrade}&section=${selectedSection}`, 'forward', 'push');
    } else {
        // Fallback to subject view
        router.push(`/subject/${selectedSubject}`, 'forward', 'push');
    }
  };

  return (
    <div
      className="ms-topic-btn"
      onClick={handleBubbleClick}
    >
      <div 
        className="ms-topic-fill-box"
        style={{ 
          border: hasData ? '2px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
          boxShadow: hasData ? '0 8px 32px rgba(0,0,0,0.2)' : 'none',
          opacity: hasData ? 1 : 0.6,
        }}
      >
        {/* LIQUID FILL LAYER */}
        <div 
            className="ms-topic-liquid-fill"
            style={{ 
                height: `${animatedPercentage || 0}%`,
                backgroundColor: performanceColor,
            }}
        />

        <div className="ms-topic-icon">
          {topic.icon || "•"}
        </div>

        {/* LIVE PERCENTAGE LABEL */}
        {hasData && (
            <div className="ms-topic-percentage-label">
                {Math.round(animatedPercentage!)}%
            </div>
        )}
      </div>
      <span 
        className={`ms-topic-label ${expandedTopic === labelKey ? 'is-expanded' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setExpandedTopic(expandedTopic === labelKey ? null : labelKey);
        }}
      >
        {topic.name}
      </span>
    </div>
  );
};

export default ProfessorTopicBubble;
