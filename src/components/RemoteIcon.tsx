import React, { memo, useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  ensureIconCached,
  peekCachedLocalUri,
  peekCachedSvg,
  subscribeIconCache,
} from '../utils/iconCache';

function isSvgUrl(uri: string): boolean {
  const u = uri.toLowerCase();
  return (
    u.includes('.svg') ||
    u.includes('image/svg') ||
    u.includes('api.iconify.design') ||
    u.includes('iconify')
  );
}

/** Renders remote PNG/JPG via Image, SVG via SvgXml. Icons are disk-cached. */
export const RemoteIcon = memo(function RemoteIcon({
  uri,
  size,
  color,
  svgXml,
  fallback,
}: {
  uri?: string;
  size: number;
  /** Tint for Iconify SVGs that use currentColor */
  color?: string;
  /** Inline SVG markup (preferred — works without CDN on device) */
  svgXml?: string;
  fallback?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [, setTick] = useState(0);
  const trimmed = uri?.trim() || '';

  useEffect(() => subscribeIconCache(() => setTick(t => t + 1)), []);

  useEffect(() => {
    setFailed(false);
    if (!trimmed || svgXml) return;
    void ensureIconCached(trimmed, color);
  }, [trimmed, color, svgXml]);

  const cachedSvg = trimmed && !svgXml ? peekCachedSvg(trimmed, color) : undefined;
  const cachedLocal = trimmed && !svgXml ? peekCachedLocalUri(trimmed) : undefined;
  const xml = svgXml && svgXml.includes('<svg') ? svgXml : cachedSvg;

  if (failed || (!trimmed && !xml)) {
    return fallback ? <Text style={{ fontSize: size * 0.9 }}>{fallback}</Text> : null;
  }

  if (xml && xml.includes('<svg')) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <SvgXml xml={xml} width={size} height={size} />
      </View>
    );
  }

  // Still downloading SVG — show fallback instead of hitting network via SvgUri
  if (trimmed && isSvgUrl(trimmed)) {
    return fallback ? <Text style={{ fontSize: size * 0.9 }}>{fallback}</Text> : null;
  }

  if (!trimmed) {
    return fallback ? <Text style={{ fontSize: size * 0.9 }}>{fallback}</Text> : null;
  }

  const sourceUri = cachedLocal || trimmed;
  return (
    <Image
      source={{ uri: sourceUri }}
      style={{ width: size, height: size }}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
});
