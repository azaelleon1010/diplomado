/**
 * Infrastructure layer re-export — keeps Presentation → Application → Domain → Infrastructure
 * Business modules import from this path, not from 'mongoose' directly.
 */
export * from '@erp/database';
