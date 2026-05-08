import { UserRole } from '../types';
import { NavigateFunction } from 'react-router-dom';

/**
 * Returns the dashboard path for a given user role.
 */
export const getRoleDashboardPath = (role: UserRole): string => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'operator':
      return '/dashboard';
    case 'guide':
      return '/dashboard';
    case 'vehicle_owner':
      return '/owner';
    case 'driver':
      return '/dashboard';
    default:
      return '/dashboard';
  }
};

/**
 * Helper to navigate a user based on their role profile.
 */
export const routeUserByRole = (role: UserRole, navigate: NavigateFunction) => {
  const path = getRoleDashboardPath(role);
  navigate(path);
};
