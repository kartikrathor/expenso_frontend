import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

/** Minimal chart glyph for Stats tab / empty analytics. */
export function StatsChartIcon({
  size = 22,
  color = '#FFF',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 19.5V6.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Path
        d="M4 19.5h16"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Rect x="7.2" y="12.2" width="2.6" height="7.3" rx="1.2" fill={color} opacity={0.9} />
      <Rect x="11.7" y="8.4" width="2.6" height="11.1" rx="1.2" fill={color} opacity={0.75} />
      <Rect x="16.2" y="10.6" width="2.6" height="8.9" rx="1.2" fill={color} opacity={0.55} />
      <Path
        d="M7.5 9.2c2.2-2.4 4.2-3.6 6.8-2.2 1.8.9 2.8 2.6 4.2 2.1"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={0.85}
      />
      <Circle cx="18.6" cy="8.8" r="1.35" fill={color} />
    </Svg>
  );
}
