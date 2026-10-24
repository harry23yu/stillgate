import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import type { ColorValue } from 'react-native';

type IconSymbolProps = {
  name: SFSymbol;
  size?: number;
  color?: ColorValue;
};

export function IconSymbol({ name, size = 20, color }: IconSymbolProps) {
  return <SymbolView name={name} size={size} tintColor={color} />;
}
