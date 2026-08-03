import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/** Soft ₹ coin + add badge — used on onboarding & empty Home. */
export function AddExpenseHeroIcon({
  size = 40,
  color = '#FFF',
  plusColor = '#4338CA',
}: {
  size?: number;
  color?: string;
  plusColor?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle cx="22" cy="26" r="16" stroke={color} strokeWidth="2.4" opacity={0.95} />
      <Circle cx="22" cy="26" r="12.2" stroke={color} strokeWidth="1.4" opacity={0.35} />
      <Path
        d="M15.2 19.2h13.6M15.2 23.4h13.6"
        stroke={color}
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <Path
        d="M28.8 19.2c0 5.2-3.4 8.2-8.4 8.2h-1.4"
        stroke={color}
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <Path
        d="M20.2 27.4L28.6 35"
        stroke={color}
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <Circle cx="36.5" cy="12.5" r="8.2" fill={color} />
      <Path
        d="M36.5 8.8v7.4M32.8 12.5h7.4"
        stroke={plusColor}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </Svg>
  );
}
