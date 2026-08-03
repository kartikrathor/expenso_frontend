import React, { memo, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { MerchantId } from '../types/expense';
import { getMerchantConfig, DEFAULT_MERCHANT } from '../constants/merchants';

interface MerchantIconProps {
  merchantId: MerchantId;
  size?: number;
}

function LetterBadge({
  size,
  letter,
  bgColor,
  color,
}: {
  size: number;
  letter: string;
  bgColor: string;
  color: string;
}) {
  return (
    <View
      style={[
        styles.defaultIcon,
        {
          width: size,
          height: size,
          borderRadius: size * 0.25,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text style={[styles.defaultLetter, { color, fontSize: size * 0.38 }]}>{letter}</Text>
    </View>
  );
}

export const MerchantIcon = memo(function MerchantIcon({ merchantId, size = 48 }: MerchantIconProps) {
  const config = merchantId === 'default' ? DEFAULT_MERCHANT : getMerchantConfig(merchantId);
  const uri = config.iconUrl?.trim();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = !!uri && failedUri === uri;

  if (uri && !failed) {
    return (
      <View
        style={[
          styles.imageWrap,
          {
            width: size,
            height: size,
            borderRadius: size * 0.25,
            backgroundColor: '#FFFFFF',
          },
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width: size * 0.78, height: size * 0.78 }}
          resizeMode="contain"
          onError={() => setFailedUri(uri)}
        />
      </View>
    );
  }

  return (
    <LetterBadge
      size={size}
      letter={config.iconLetter}
      bgColor={config.bgColor}
      color={config.color}
    />
  );
});

const styles = StyleSheet.create({
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  defaultIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultLetter: {
    fontWeight: '800',
  },
});
