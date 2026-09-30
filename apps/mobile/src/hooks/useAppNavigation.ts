import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type {
  MainTabParamList,
  MoreStackParamList,
  OperationsStackParamList,
  RootStackParamList,
} from '../navigation/types';

export type AppParamList = RootStackParamList &
  MainTabParamList &
  OperationsStackParamList &
  MoreStackParamList;

/**
 * Single typed navigator handle for the whole app.
 * `navigate()` bubbles up the navigator tree, so tab screens can open
 * root-stack details and stack screens can jump to tabs.
 */
export function useAppNavigation(): NavigationProp<AppParamList> {
  return useNavigation<NavigationProp<AppParamList>>();
}
