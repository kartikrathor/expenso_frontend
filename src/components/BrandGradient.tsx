import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { getActionGradient, getActionGradientPoints } from '../constants/themePacks';

type Props = {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Override axis; default = Spidey L→R red→navy / pack style */
  start?: { x: number; y: number };
  end?: { x: number; y: number };
};

/**
 * Shared CTA / pill gradient. Red Web Spider → horizontal red → navy suit stripe.
 */
export function BrandGradient({ style, children, start, end }: Props) {
  const { colors, packId, gradientStyle } = useTheme();
  const axis = getActionGradientPoints(packId, gradientStyle);
  return (
    <LinearGradient
      colors={getActionGradient(colors, packId)}
      start={start ?? axis.start}
      end={end ?? axis.end}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}
