import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import type { ColorValue } from 'react-native';

type IconSymbolProps = {
  name: SFSymbol;
  size?: number;
  color?: ColorValue;
};

/**
 * SF Symbols only exist on iOS. SymbolView draws Material Symbols on Android
 * and web when given their names, so every SF Symbol the app uses needs an
 * entry here — otherwise the icon (and every map pin) is blank off iOS.
 */
const MATERIAL_EQUIVALENT: Partial<Record<SFSymbol, AndroidSymbol>> = {
  airplane: 'flight',
  'arrow.counterclockwise': 'refresh',
  'arrow.down.circle.fill': 'download_for_offline',
  'arrow.right': 'arrow_forward',
  checkmark: 'check',
  'checkmark.seal.fill': 'verified',
  'chevron.right': 'chevron_right',
  'exclamationmark.triangle.fill': 'warning',
  'figure.walk': 'directions_walk',
  'fork.knife': 'restaurant',
  'gearshape.fill': 'settings',
  'hand.raised.fill': 'back_hand',
  'house.fill': 'home',
  'info.circle.fill': 'info',
  'location.fill': 'location_on',
  map: 'map',
  minus: 'remove',
  'moon.zzz.fill': 'bedtime',
  'pause.fill': 'pause',
  pencil: 'edit',
  'person.crop.circle': 'account_circle',
  plus: 'add',
  sparkles: 'auto_awesome',
  'square.dashed': 'select',
  trash: 'delete',
  waveform: 'graphic_eq',
  xmark: 'close',
};

export function IconSymbol({ name, size = 20, color }: IconSymbolProps) {
  const material = MATERIAL_EQUIVALENT[name];
  return (
    <SymbolView
      name={material ? { ios: name, android: material, web: material } : name}
      size={size}
      tintColor={color}
    />
  );
}
