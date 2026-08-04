import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { CategoryId } from '../types/expense';
import { getCategoryConfig } from '../constants/categories';
import { useCategoryStore } from '../store/categoryStore';
import { RemoteIcon } from './RemoteIcon';

type Props = {
  categoryId: CategoryId;
  size?: number;
  /** Filled tile background (default true) */
  withBackground?: boolean;
};

function FoodGlyph({ color, size }: { color: string; size: number }) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 10.5c0-2.2 1.8-4 4-4h.3c.4-1.5 1.8-2.5 3.4-2.5 1.5 0 2.9.9 3.3 2.3h.2c2.1 0 3.8 1.7 3.8 3.8v.4c1.3.4 2.2 1.6 2.2 3 0 1.8-1.4 3.2-3.2 3.2H7.2C5.2 16.7 3.5 15 3.5 13c0-1.1.5-2.1 1.3-2.7.1.1.1.1.1.2z"
        fill={color}
        opacity={0.95}
      />
      <Path
        d="M8 17.2v1.3c0 1.3 1.1 2.3 2.4 2.3h3.2c1.3 0 2.4-1 2.4-2.3v-1.3"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function GroceriesGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 8h12l-1.2 9.2A2 2 0 0 1 15.8 19H9.3a2 2 0 0 1-2-1.7L6 6H3.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="10" cy="21" r="1.2" fill={color} />
      <Circle cx="16.5" cy="21" r="1.2" fill={color} />
      <Path d="M9 11h8M8.5 14.5h7" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity={0.7} />
    </Svg>
  );
}

function ShoppingGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 8.5h12l-1 10.2A1.8 1.8 0 0 1 15.2 20H8.8A1.8 1.8 0 0 1 7 18.7L6 8.5z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Path
        d="M9 8.5V7a3 3 0 0 1 6 0v1.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function TransportGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 15.5V11c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6v4.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Path
        d="M3.5 15.5h17"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Circle cx="7.5" cy="18" r="1.6" fill={color} />
      <Circle cx="16.5" cy="18" r="1.6" fill={color} />
      <Path d="M8 11h8" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity={0.65} />
    </Svg>
  );
}

function EntertainmentGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3.5" y="6" width="17" height="12" rx="2.5" stroke={color} strokeWidth="1.8" />
      <Path d="M10 10.2l4.2 2.3-4.2 2.3V10.2z" fill={color} />
    </Svg>
  );
}

function BillsGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 3.8h10a1.5 1.5 0 0 1 1.5 1.5v14.2L16.2 17l-2.2 2.2L12 17.2 9.8 19.2 7.6 17 5.5 19.5V5.3A1.5 1.5 0 0 1 7 3.8z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <Path d="M9 8.2h6M9 11.2h6M9 14.2h3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function HealthGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s-7.2-4.4-7.2-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.2 3.6C19.2 16.6 12 21 12 21z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Path d="M12 9.8v5.2M9.4 12.4h5.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

function RentGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 11.5L12 5l8 6.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.5 10.8V19h11V10.8"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Path d="M10 19v-5h4v5" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  );
}

function TaxesGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 3.5h7.2L19 8.3V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <Path d="M14 3.8V8h4.2" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <Path
        d="M9.2 13.2l5.6 5.2M14.8 13.2l-5.6 5.2"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Circle cx="9.6" cy="11.2" r="1.1" fill={color} />
      <Circle cx="14.4" cy="18.4" r="1.1" fill={color} />
    </Svg>
  );
}

function GiftsGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4.5" y="10" width="15" height="10" rx="1.5" stroke={color} strokeWidth="1.7" />
      <Path d="M4.5 13.5h15M12 10v10" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <Path
        d="M12 10c-1.8-2.8-4.8-3.2-5.8-1.6C5 10 6.6 11.5 12 10z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <Path
        d="M12 10c1.8-2.8 4.8-3.2 5.8-1.6C19 10 17.4 11.5 12 10z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DonationGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 19.5s-6.2-3.7-6.2-8.6A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 6.2 2.9c0 4.9-6.2 8.6-6.2 8.6z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Path
        d="M4.5 11.5c1.2.3 2.4.2 3.5-.3M19.5 11.5c-1.2.3-2.4.2-3.5-.3"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={0.75}
      />
    </Svg>
  );
}

function InsuranceGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5l7 3v5.2c0 4.4-3 7.4-7 8.8-4-1.4-7-4.4-7-8.8V6.5l7-3z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Path
        d="M9.2 12.2l2 2 4-4.2"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PersonalCareGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="7.2" r="3" stroke={color} strokeWidth="1.7" />
      <Path
        d="M6.5 19.2c.7-3.2 2.8-4.8 5.5-4.8s4.8 1.6 5.5 4.8"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <Path
        d="M16.8 5.2c1.2-.2 2.2.5 2.4 1.6M6.8 5.2C5.6 5 4.6 5.7 4.4 6.8"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={0.75}
      />
    </Svg>
  );
}

function OtherGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="7" width="16" height="12" rx="2.2" stroke={color} strokeWidth="1.8" />
      <Path d="M8 7V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8V7" stroke={color} strokeWidth="1.6" />
      <Circle cx="12" cy="13" r="1.5" fill={color} />
    </Svg>
  );
}

const GLYPHS: Record<string, React.FC<{ color: string; size: number }>> = {
  food: FoodGlyph,
  groceries: GroceriesGlyph,
  shopping: ShoppingGlyph,
  transport: TransportGlyph,
  entertainment: EntertainmentGlyph,
  bills: BillsGlyph,
  rent: RentGlyph,
  taxes: TaxesGlyph,
  gifts: GiftsGlyph,
  donation: DonationGlyph,
  insurance: InsuranceGlyph,
  personal_care: PersonalCareGlyph,
  health: HealthGlyph,
  other: OtherGlyph,
};

/**
 * Relatable category icon (SVG). Used on cards when merchant is unknown,
 * and in category chips / badges. Prefer admin-uploaded/fetched iconUrl when set.
 */
export const CategoryIcon = memo(function CategoryIcon({ categoryId, size = 46, withBackground = true }: Props) {
  const storeConfig = useCategoryStore(s => s.getConfig(categoryId));
  const config = storeConfig || getCategoryConfig(categoryId);
  const uri = config.iconUrl?.trim();
  const HasGlyph = !!(GLYPHS[config.id] || GLYPHS[categoryId]);
  const Glyph = GLYPHS[config.id] || GLYPHS[categoryId] || OtherGlyph;
  const glyphSize = Math.round(size * (withBackground ? 0.52 : 0.9));

  const inner = uri ? (
    <RemoteIcon uri={uri} size={glyphSize} color={config.color} fallback={config.emoji} />
  ) : HasGlyph ? (
    <Glyph color={config.color} size={glyphSize} />
  ) : (
    <Text style={{ fontSize: glyphSize * 0.85 }}>{config.emoji || (config.label || '?')[0]}</Text>
  );

  if (!withBackground) {
    return <>{inner}</>;
  }

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: config.color + '22',
          borderColor: config.color + '44',
        },
      ]}
    >
      {inner}
    </View>
  );
});

/** Tiny glyph for chips / badges (no tile). Falls back to letter for unknown custom cats. */
export const CategoryGlyph = memo(function CategoryGlyph({
  categoryId,
  size = 14,
  color,
}: {
  categoryId: CategoryId;
  size?: number;
  color?: string;
}) {
  const storeConfig = useCategoryStore(s => s.getConfig(categoryId));
  const config = storeConfig || getCategoryConfig(categoryId);
  const uri = config.iconUrl?.trim();

  if (uri) {
    return <RemoteIcon uri={uri} size={size} color={color || config.color} fallback={config.emoji} />;
  }

  const Glyph = GLYPHS[config.id] || GLYPHS[categoryId];
  if (!Glyph) {
    // Custom / unknown: prefer emoji, then first letter
    if (config.emoji) {
      return <Text style={{ fontSize: size * 0.95 }}>{config.emoji}</Text>;
    }
    return (
      <Text style={{ fontSize: size * 0.9, color: color || config.color, fontWeight: '700' }}>
        {(config.label || '?')[0]}
      </Text>
    );
  }
  return <Glyph color={color || config.color} size={size} />;
});

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
