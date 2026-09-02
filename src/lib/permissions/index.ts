// ============================================================================
// Permission layer entry point
// ============================================================================
// Components import `permissionService` and never the implementation. Swapping
// the mock for a real backend service is a one-line change here:
//
//   export const permissionService: PermissionService = new BackendPermissionService();
//
// Until then the UI simulates decisions and labels them as simulated.
// ============================================================================

import type { PermissionService } from './types';
import { MockPermissionService } from './MockPermissionService';

export const permissionService: PermissionService = new MockPermissionService();

export * from './types';
export { ROLES, ROLE_ORDER, DEMO_AREAS } from './roles';
