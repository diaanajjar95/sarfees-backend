import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '../enums/admin-role.enum';

export const ROLES_KEY = 'admin_roles';

/**
 * Restrict an admin endpoint to one or more roles.
 * Used together with `@UseGuards(AuthGuard('jwt-admin'), RolesGuard)`.
 * Omitting the decorator means any authenticated admin can access.
 */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
