import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Clean ₹ mark for brand logo (Auth / Onboarding). */
export function ExpensoMarkIcon({
  size = 40,
  color = '#FFF',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path
        d="M14 14h20"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <Path
        d="M14 22h20"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <Path
        d="M34 14c0 8.2-5.4 13.2-13.4 13.2H18"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <Path
        d="M18 27.2L33 38"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </Svg>
  );
}
