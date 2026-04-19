import React from 'react';
import { useAnimatedScore } from '../hooks/useAnimatedScore';
import { TopicProgress } from '../types/student';

interface TopicBubbleProps {
  topic: TopicProgress;
  index: number;
  getColorForPercentage: (p: number) => string;
  expandedTopic: string | null;
  setExpandedTopic: (val: string | null) => void;
  navigateTo: (path: string) => void;
  selectedSubject: string;
}

export const TopicBubble: React.FC<TopicBubbleProps> = ({
  topic,
  index,
  getColorForPercentage,
  expandedTopic,
  setExpandedTopic,
  navigateTo,
  selectedSubject
}) => {
  const animatedPercentage = useAnimatedScore(topic.percentage);
  const hasData = topic.id && animatedPercentage !== null;
  
  const performanceColor = hasData 
    ? getColorForPercentage(animatedPercentage!) 
    : "rgba(255, 255, 255, 0.15)";

  const labelKey = `${index}-${topic.name}`;

  return (
    <div
      className="ms-topic-btn"
      onClick={() =>
        topic.id 
          ? navigateTo(`/page/topic/${topic.id}`)
          : navigateTo(`/subject/${selectedSubject}`)
      }
    >
      <div 
        className="ms-topic-fill-box"
        style={{ 
          backgroundColor: performanceColor,
          border: hasData ? '2px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
          boxShadow: hasData ? '0 4px 10px rgba(0,0,0,0.1)' : 'none',
          opacity: hasData ? 1 : 0.6,
          transition: "background-color 0.5s ease, border 0.5s ease"
        }}
      >
        <div className="ms-topic-icon">
          {topic.icon || "•"}
        </div>
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

export default TopicBubble;
