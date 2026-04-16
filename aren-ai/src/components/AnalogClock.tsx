import React, { useEffect, useState } from 'react';

const AnalogClock: React.FC = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const seconds = time.getSeconds();
    const minutes = time.getMinutes();
    const hours = time.getHours();

    const secDeg = (seconds / 60) * 360;
    const minDeg = (minutes / 60) * 360 + (seconds / 60) * 6;
    const hourDeg = (hours % 12 / 12) * 360 + (minutes / 60) * 30;

    return (
        <div className="analog-clock-container">
            <svg viewBox="0 0 100 100" className="analog-clock-svg">
                {/* Clock Face */}
                <circle cx="50" cy="50" r="48" className="clock-face" />
                
                {/* Hour Markers */}
                {[...Array(12)].map((_, i) => (
                    <line
                        key={i}
                        x1="50" y1="8" x2="50" y2="12"
                        transform={`rotate(${i * 30} 50 50)`}
                        className="clock-marker"
                    />
                ))}

                {/* Hands */}
                <line 
                    x1="50" y1="50" x2="50" y2="25" 
                    transform={`rotate(${hourDeg} 50 50)`} 
                    className="clock-hand hour" 
                    style={{ transition: 'transform 0.5s cubic-bezier(0.4, 2.08, 0.55, 0.44)' }}
                />
                <line 
                    x1="50" y1="50" x2="50" y2="15" 
                    transform={`rotate(${minDeg} 50 50)`} 
                    className="clock-hand minute" 
                    style={{ transition: 'transform 0.5s cubic-bezier(0.4, 2.08, 0.55, 0.44)' }}
                />
                <line 
                    x1="50" y1="50" x2="50" y2="10" 
                    transform={`rotate(${secDeg} 50 50)`} 
                    className="clock-hand second" 
                    style={{ transition: 'transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)' }}
                />
                
                {/* Center dot */}
                <circle cx="50" cy="50" r="2" className="clock-center" />
            </svg>
        </div>
    );
};

export default AnalogClock;
