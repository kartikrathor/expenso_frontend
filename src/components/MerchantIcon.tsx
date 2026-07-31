import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Rect, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { MerchantId } from '../types/expense';
import { getMerchantConfig, DEFAULT_MERCHANT } from '../constants/merchants';
import { Radius } from '../constants/theme';

interface MerchantIconProps {
  merchantId: MerchantId;
  size?: number;
}

function BlinkitIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width="48" height="48" rx="12" fill="#1A3A2A" />
      <Circle cx="24" cy="24" r="14" fill="#F8E71C" />
      <Path d="M18 24 L24 18 L30 24 L24 30 Z" fill="#1A3A2A" />
    </Svg>
  );
}

function ZeptoIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="zepto" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#7B2DFF" />
          <Stop offset="1" stopColor="#FF006B" />
        </LinearGradient>
      </Defs>
      <Rect width="48" height="48" rx="12" fill="url(#zepto)" />
      <Path d="M14 30 L24 14 L34 30 Z" fill="#FFF" opacity={0.9} />
    </Svg>
  );
}

function AmazonIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width="48" height="48" rx="12" fill="#232F3E" />
      <Path d="M12 28 Q24 36 36 28" stroke="#FF9900" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Path d="M30 26 L36 28 L30 30" fill="#FF9900" />
    </Svg>
  );
}

function FlipkartIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width="48" height="48" rx="12" fill="#2874F0" />
      <Path d="M14 16 L34 16 L28 32 L18 32 Z" fill="#FFE500" />
      <Path d="M20 22 L28 22" stroke="#2874F0" strokeWidth="2" />
    </Svg>
  );
}

function SwiggyIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width="48" height="48" rx="12" fill="#FC8019" />
      <Circle cx="24" cy="24" r="10" fill="#FFF" opacity={0.2} />
      <Path d="M18 28 Q24 18 30 28" stroke="#FFF" strokeWidth="3" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function ZomatoIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width="48" height="48" rx="12" fill="#E23744" />
      <Circle cx="24" cy="24" r="12" fill="#FFF" opacity={0.15} />
      <Path d="M24 14 L24 34 M18 20 L30 20" stroke="#FFF" strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

function MyntraIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="myntra" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF3F6C" />
          <Stop offset="1" stopColor="#C0134A" />
        </LinearGradient>
      </Defs>
      <Rect width="48" height="48" rx="12" fill="url(#myntra)" />
      {/* M shape */}
      <Path d="M12 32 L12 16 L24 26 L36 16 L36 32" stroke="#FFF" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function UberIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width="48" height="48" rx="12" fill="#000000" />
      {/* U shape */}
      <Path d="M16 16 L16 28 Q16 34 24 34 Q32 34 32 28 L32 16" stroke="#FFF" strokeWidth="3.2" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function OlaIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width="48" height="48" rx="12" fill="#1E3A1E" />
      {/* O + lightning */}
      <Circle cx="21" cy="24" r="9" stroke="#4CAF50" strokeWidth="3" fill="none" />
      <Path d="M33 16 L29 24 L33 24 L28 32" stroke="#4CAF50" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function NetflixIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width="48" height="48" rx="12" fill="#1A0000" />
      {/* N shape */}
      <Path d="M15 14 L15 34 L22 34 L22 24 L26 34 L33 34 L33 14 L26 14 L26 24 L22 14 Z" fill="#E50914" />
    </Svg>
  );
}

function SpotifyIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width="48" height="48" rx="12" fill="#0A1F0F" />
      <Circle cx="24" cy="24" r="13" fill="#1DB954" />
      {/* 3 sound waves */}
      <Path d="M16 20 Q24 17 32 20" stroke="#0A1F0F" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <Path d="M17 24 Q24 21 31 24" stroke="#0A1F0F" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <Path d="M18 28 Q24 25 30 28" stroke="#0A1F0F" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function PaytmIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width="48" height="48" rx="12" fill="#002970" />
      {/* Paytm style P */}
      <Rect x="13" y="13" width="5" height="22" rx="2.5" fill="#00BAF2" />
      <Path d="M18 13 Q30 13 30 20 Q30 27 18 27" stroke="#00BAF2" strokeWidth="5" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function PhonePeIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="phonepe" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5F259F" />
          <Stop offset="1" stopColor="#3B0A6E" />
        </LinearGradient>
      </Defs>
      <Rect width="48" height="48" rx="12" fill="url(#phonepe)" />
      {/* Phone outline + Pe */}
      <Rect x="16" y="11" width="16" height="26" rx="4" stroke="#FFF" strokeWidth="2.5" fill="none" />
      <Circle cx="24" cy="33" r="1.5" fill="#FFF" />
      <Path d="M20 19 L20 28 M20 19 Q28 19 28 23.5 Q28 28 20 28" stroke="#FFF" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function DefaultIcon({ size, letter, bgColor, color }: { size: number; letter: string; bgColor: string; color: string }) {
  return (
    <View style={[styles.defaultIcon, { width: size, height: size, borderRadius: size * 0.25, backgroundColor: bgColor }]}>
      <Text style={[styles.defaultLetter, { color, fontSize: size * 0.38 }]}>{letter}</Text>
    </View>
  );
}

const ICON_MAP: Partial<Record<MerchantId, React.FC<{ size: number }>>> = {
  blinkit: BlinkitIcon,
  zepto: ZeptoIcon,
  amazon: AmazonIcon,
  flipkart: FlipkartIcon,
  swiggy: SwiggyIcon,
  zomato: ZomatoIcon,
  myntra: MyntraIcon,
  uber: UberIcon,
  ola: OlaIcon,
  netflix: NetflixIcon,
  spotify: SpotifyIcon,
  paytm: PaytmIcon,
  phonepe: PhonePeIcon,
};

export function MerchantIcon({ merchantId, size = 48 }: MerchantIconProps) {
  const IconComponent = ICON_MAP[merchantId];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }

  const config = merchantId === 'default' ? DEFAULT_MERCHANT : getMerchantConfig(merchantId);
  return (
    <DefaultIcon
      size={size}
      letter={config.iconLetter}
      bgColor={config.bgColor}
      color={config.color}
    />
  );
}

const styles = StyleSheet.create({
  defaultIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultLetter: {
    fontWeight: '800',
  },
});
