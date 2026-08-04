import { ImageSourcePropType } from 'react-native';
import type { ThemePackId } from './themePacks';

/** In-app previews for Themes screen (not the launcher mipmaps). */
export const APP_ICON_PREVIEWS: Record<ThemePackId, ImageSourcePropType> = {
  ocean: require('../assets/app-icons/ocean.png'),
  mint: require('../assets/app-icons/mint.png'),
  sunset: require('../assets/app-icons/sunset.png'),
  royal: require('../assets/app-icons/royal.png'),
  rose: require('../assets/app-icons/rose.png'),
  lavender: require('../assets/app-icons/lavender.png'),
  mono: require('../assets/app-icons/mono.png'),
  forest: require('../assets/app-icons/forest.png'),
  midnight_gold: require('../assets/app-icons/midnight_gold.png'),
  paper: require('../assets/app-icons/paper.png'),
  neon: require('../assets/app-icons/neon.png'),
  red_web_spider: require('../assets/app-icons/red_web_spider.png'),
};
