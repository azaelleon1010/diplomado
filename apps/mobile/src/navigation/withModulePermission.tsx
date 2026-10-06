import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { PermissionDeniedScreen } from '../screens/PermissionDeniedScreen';
import { hasAnyPermission } from './moduleAccess';

export function withModulePermission(
  Screen: () => React.JSX.Element,
  requiredAnyPermissions: readonly string[],
): () => React.JSX.Element {
  function PermissionCheckedScreen(): React.JSX.Element {
    const { me } = useAuth();
    if (!hasAnyPermission(me?.permissions ?? [], requiredAnyPermissions)) {
      return <PermissionDeniedScreen />;
    }
    return <Screen />;
  }
  return PermissionCheckedScreen;
}
