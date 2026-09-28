declare module 'react-native-web' {
  import type * as React from 'react';

  export const View: React.ComponentType<any>;
  export const Text: React.ComponentType<any>;
  export const TextInput: React.ComponentType<any>;
  export const TouchableOpacity: React.ComponentType<any>;
  export const ScrollView: React.ComponentType<any>;

  export const StyleSheet: {
    create<T extends Record<string, any>>(styles: T): T;
  };

  export const FlatList: <T>(props: {
    data?: readonly T[] | null;
    keyExtractor?: (item: T, index: number) => string;
    renderItem?: (info: {
      item: T;
      index: number;
    }) => React.ReactNode;

    ListEmptyComponent?:
      | React.ReactNode
      | React.ComponentType<any>;

    inverted?: boolean;

    keyboardShouldPersistTaps?:
      | boolean
      | 'always'
      | 'never'
      | 'handled'
      | string;

    style?: any;
    contentContainerStyle?: any;
  }) => React.ReactElement | null;
}