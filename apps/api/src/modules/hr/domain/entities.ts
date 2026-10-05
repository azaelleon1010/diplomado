/**
 * HR domain entities — pure TypeScript.
 * No Express, no Mongoose, no JWT, no bcrypt allowed in this layer.
 *
 * Deliberately free of sensitive payroll data: only operational workforce
 * data (identity, assignment, attendance-relevant status, time off).
 */

export type DepartmentStatus = 'ACTIVE' | 'INACTIVE';

export interface Department {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: DepartmentStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

export interface Employee {
  _id: string;
  tenantId: string;
  code: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  departmentId?: string;
  position?: string;
  location?: string;
  hireDate?: string;
  status: EmployeeStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export type TimeOffType = 'VACATION' | 'SICK' | 'PERMISSION';
export type TimeOffStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface TimeOff {
  _id: string;
  tenantId: string;
  employeeId: string;
  type: TimeOffType;
  startDate: string;
  endDate: string;
  status: TimeOffStatus;
  reason?: string;
  decidedBy?: string;
  decidedAt?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export const HR_ACTIONS = {
  DEPARTMENT_CREATED: 'hr.department.created',
  DEPARTMENT_UPDATED: 'hr.department.updated',
  DEPARTMENT_DEACTIVATED: 'hr.department.deactivated',
  EMPLOYEE_CREATED: 'hr.employee.created',
  EMPLOYEE_UPDATED: 'hr.employee.updated',
  EMPLOYEE_DEACTIVATED: 'hr.employee.deactivated',
  TIMEOFF_CREATED: 'hr.timeoff.created',
  TIMEOFF_APPROVED: 'hr.timeoff.approved',
  TIMEOFF_REJECTED: 'hr.timeoff.rejected',
  TIMEOFF_CANCELLED: 'hr.timeoff.cancelled',
} as const;
