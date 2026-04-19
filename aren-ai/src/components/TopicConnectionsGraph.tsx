import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

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
  const fathers = useMemo(() => relations.filter(r => r.type === 'father'), [relations]);
  const sons = useMemo(() => relations.filter(r => r.type === 'son'), [relations]);

  // Dimensions & Layout
  const width = 350;
  const height = 400;
  const heroX = width / 2;
  const heroY = height / 2;
  const heroRadius = 40;
  const satelliteRadius = 25;

  const getPerformanceColor = (score: number | null) => {
    if (score === null || score === undefined) return 'var(--ion-color-medium)';
    if (score >= 70) return 'var(--ion-color-success)';
    if (score >= 40) return 'var(--ion-color-warning)';
    return 'var(--ion-color-danger)';
  };

  const heroColor = getPerformanceColor(heroScore);

  // Position calculations
  const calculateSatelliteX = (index: number, total: number) => {
    if (total === 1) return width / 2;
    const spacing = width / (total + 1);
    return spacing * (index + 1);
  };

  return (
    <div className="tc-graph-container" style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <defs>
          {/* Gradients for relations */}
          {relations.map((rel, idx) => {
            const isFather = rel.type === 'father';
            const color = getPerformanceColor(rel.score);
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
          
          {/* Shadows */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Lines */}
        {fathers.map((f, i) => {
          const fx = calculateSatelliteX(i, fathers.length);
          const fy = 60;
          const strokeWidth = 2 + (f.correlation_coefficient || 0.5) * 8;
          return (
            <motion.line
              key={`line-f-${i}`}
              x1={fx} y1={fy}
              x2={heroX} y2={heroY}
              stroke={`url(#grad-${relations.indexOf(f)})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          );
        })}

        {sons.map((s, i) => {
          const sx = calculateSatelliteX(i, sons.length);
          const sy = height - 60;
          const strokeWidth = 2 + (s.correlation_coefficient || 0.5) * 8;
          return (
            <motion.line
              key={`line-s-${i}`}
              x1={heroX} y1={heroY}
              x2={sx} y2={sy}
              stroke={`url(#grad-${relations.indexOf(s)})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          );
        })}

        {/* Hero Ball */}
        <motion.g
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200 }}
        >
          <circle 
            cx={heroX} cy={heroY} r={heroRadius} 
            fill={heroColor} 
            filter="url(#glow)"
            style={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2 }}
          />
          <text 
            x={heroX} y={heroY} 
            textAnchor="middle" dy=".3em" 
            fill="white" 
            style={{ fontSize: '12px', fontWeight: 'bold', pointerEvents: 'none' }}
          >
            {heroName.length > 10 ? heroName.substring(0, 8) + '...' : heroName}
          </text>
        </motion.g>

        {/* Father Balls */}
        {fathers.map((f, i) => {
          const fx = calculateSatelliteX(i, fathers.length);
          const fy = 60;
          return (
            <motion.g
              key={`father-${i}`}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              <circle 
                cx={fx} cy={fy} r={satelliteRadius} 
                fill={getPerformanceColor(f.score)} 
                filter="url(#glow)"
                style={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
              />
              <text 
                x={fx} y={fy + satelliteRadius + 15} 
                textAnchor="middle" 
                fill="var(--ion-text-color)" 
                style={{ fontSize: '10px', fontWeight: '600' }}
              >
                {f.name}
              </text>
            </motion.g>
          );
        })}

        {/* Son Balls */}
        {sons.map((s, i) => {
          const sx = calculateSatelliteX(i, sons.length);
          const sy = height - 60;
          return (
            <motion.g
              key={`son-${i}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              <circle 
                cx={sx} cy={sy} r={satelliteRadius} 
                fill={getPerformanceColor(s.score)} 
                filter="url(#glow)"
                style={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
              />
              <text 
                x={sx} y={sy + satelliteRadius + 15} 
                textAnchor="middle" 
                fill="var(--ion-text-color)" 
                style={{ fontSize: '10px', fontWeight: '600' }}
              >
                {s.name}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
};

export default TopicConnectionsGraph;
