import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useIonRouter } from '@ionic/react';
import './TopicConnectionsGraph.css';

interface TopicRelation {
  id_topic: number;
  name: string;
  type: "father" | "son";
  correlation_coefficient: number | null;
  score: number | null;
}

interface TopicConnectionsGraphProps {
  heroName: string;
  heroScore: number;
  relations: TopicRelation[];
}

const TopicConnectionsGraph: React.FC<TopicConnectionsGraphProps> = ({ heroName, heroScore, relations }) => {
  const router = useIonRouter();
  const fathers = useMemo(() => relations.filter(r => r.type === 'father'), [relations]);
  const sons = useMemo(() => relations.filter(r => r.type === 'son'), [relations]);

  // Dimensions & Layout
  const width = 420; // Slightly more width
  const height = 480; 
  const heroX = width / 2;
  const heroY = height / 2;
  const heroRadius = 50; // Bigger hero
  const satelliteRadius = 26; // Slightly bigger satellites

  const getPremiumPerformanceColor = (score: number | null) => {
    if (score === null || score === undefined) return '#94a3b8'; // slate-400
    if (score >= 85) return '#10b981'; // emerald-500
    if (score >= 70) return '#34d399'; // emerald-400
    if (score >= 55) return '#fbbf24'; // amber-400
    if (score >= 40) return '#fcd34d'; // amber-300
    return '#f43f5e'; // rose-500
  };

  const heroColor = getPremiumPerformanceColor(heroScore);

  // Staggered Y calculation
  const getSatelliteY = (type: 'father' | 'son', index: number) => {
    const baseMargin = 85;
    const stagger = (index % 2 === 0) ? 0 : 45;
    if (type === 'father') return baseMargin + stagger;
    return height - baseMargin - stagger;
  };

  const calculateSatelliteX = (index: number, total: number) => {
    if (total === 1) return width / 2;
    const padding = 60;
    const availableWidth = width - (padding * 2);
    const spacing = availableWidth / (total - 1);
    return padding + (spacing * index);
  };

  const handleNavigate = (topicId: number) => {
    const role = localStorage.getItem("userRole");
    const path = role === "professor" ? `/page/class-topic/${topicId}` : `/page/topic/${topicId}`;
    router.push(path, 'forward', 'push');
  };

  // Helper for label rendering with background and wrapping
  const renderLabel = (x: number, y: number, name: string, isFather: boolean, topicId: number) => {
    const labelWidth = 120;
    const labelHeight = 50;
    const labelY = isFather ? y - 70 : y + 28; 

    return (
      <foreignObject 
        x={x - labelWidth / 2} 
        y={labelY} 
        width={labelWidth} 
        height={labelHeight}
        style={{ overflow: 'visible' }}
        onClick={() => handleNavigate(topicId)}
      >
        <div className="tc-label-wrapper clickable">
          <div className="tc-label-content">
            {name}
          </div>
        </div>
      </foreignObject>
    );
  };

  return (
    <div className="tc-graph-container">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="tc-svg-canvas">
        <defs>
          {relations.map((rel, idx) => {
            const isFather = rel.type === 'father';
            const color = getPremiumPerformanceColor(rel.score);
            return (
              <linearGradient 
                key={`grad-${idx}`} 
                id={`grad-${idx}`} 
                x1="0%" y1={isFather ? "0%" : "100%"} 
                x2="0%" y2={isFather ? "100%" : "0%"}
              >
                <stop offset="0%" stopColor={color} />
                <stop offset="100%" stopColor={heroColor} />
              </linearGradient>
            );
          })}
          
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Relation Lines */}
        {fathers.map((f, i) => {
          const fx = calculateSatelliteX(i, fathers.length);
          const fy = getSatelliteY('father', i);
          const strength = f.correlation_coefficient || 0.5;
          const strokeWidth = 3 + strength * 14;
          const opacity = 0.3 + strength * 0.6;
          
          return (
            <g key={`line-group-f-${i}`}>
              <motion.line
                x1={fx} y1={fy}
                x2={heroX} y2={heroY}
                stroke={`url(#grad-${relations.indexOf(f)})`}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
                style={{ filter: strength > 0.7 ? 'url(#glow)' : 'none' }}
              />
              <motion.line
                x1={fx} y1={fy}
                x2={heroX} y2={heroY}
                stroke="white"
                strokeWidth={strokeWidth / 2}
                strokeDasharray="10 20"
                strokeOpacity={0.4}
                initial={{ strokeDashoffset: 30 }}
                animate={{ strokeDashoffset: -30 }}
                transition={{ repeat: Infinity, duration: 1 / strength, ease: "linear" }}
              />
            </g>
          );
        })}

        {sons.map((s, i) => {
          const sx = calculateSatelliteX(i, sons.length);
          const sy = getSatelliteY('son', i);
          const strength = s.correlation_coefficient || 0.5;
          const strokeWidth = 3 + strength * 14;
          const opacity = 0.3 + strength * 0.6;
          
          return (
            <g key={`line-group-s-${i}`}>
              <motion.line
                x1={heroX} y1={heroY}
                x2={sx} y2={sy}
                stroke={`url(#grad-${relations.indexOf(s)})`}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
                style={{ filter: strength > 0.7 ? 'url(#glow)' : 'none' }}
              />
              <motion.line
                x1={heroX} y1={heroY}
                x2={sx} y2={sy}
                stroke="white"
                strokeWidth={strokeWidth / 2}
                strokeDasharray="10 20"
                strokeOpacity={0.4}
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: -30 }}
                transition={{ repeat: Infinity, duration: 1 / strength, ease: "linear" }}
              />
            </g>
          );
        })}

        {/* Satellite Nodes & Labels */}
        {fathers.map((f, i) => {
          const fx = calculateSatelliteX(i, fathers.length);
          const fy = getSatelliteY('father', i);
          return (
            <g key={`father-node-${i}`} className="tc-satellite-group clickable" onClick={() => handleNavigate(f.id_topic)}>
              <motion.circle 
                cx={fx} cy={fy} r={satelliteRadius} 
                fill={getPremiumPerformanceColor(f.score)} 
                filter="url(#glow)"
                style={{ stroke: 'rgba(255,255,255,0.4)', strokeWidth: 2 }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                whileHover={{ scale: 1.15 }}
              />
              {renderLabel(fx, fy, f.name, true, f.id_topic)}
            </g>
          );
        })}

        {sons.map((s, i) => {
          const sx = calculateSatelliteX(i, sons.length);
          const sy = getSatelliteY('son', i);
          return (
            <g key={`son-node-${i}`} className="tc-satellite-group clickable" onClick={() => handleNavigate(s.id_topic)}>
              <motion.circle 
                cx={sx} cy={sy} r={satelliteRadius} 
                fill={getPremiumPerformanceColor(s.score)} 
                filter="url(#glow)"
                style={{ stroke: 'rgba(255,255,255,0.4)', strokeWidth: 2 }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                whileHover={{ scale: 1.15 }}
              />
              {renderLabel(sx, sy, s.name, false, s.id_topic)}
            </g>
          );
        })}

        {/* Hero Central Node */}
        <motion.g
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200 }}
        >
          <circle 
            cx={heroX} cy={heroY} r={heroRadius} 
            fill={heroColor} 
            filter="url(#hero-glow)"
            style={{ stroke: 'rgba(255,255,255,0.5)', strokeWidth: 4 }}
          />
          <foreignObject
            x={heroX - heroRadius + 8}
            y={heroY - heroRadius + 8}
            width={heroRadius * 2 - 16}
            height={heroRadius * 2 - 16}
          >
            <div className="tc-hero-label-container">
              <span className="tc-hero-label-text">
                {heroName}
              </span>
            </div>
          </foreignObject>
        </motion.g>
      </svg>
    </div>
  );
};

export default TopicConnectionsGraph;
