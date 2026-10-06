/**
 * HR ports — abstractions owned by the Domain.
 * Infrastructure provides the implementations.
 * TxSession is reused from tenant ports (opaque handle, no driver in Domain).
 */
import type { TxSession } from '../../tenant/domain/ports';
import type {
  Department,
  DepartmentStatus,
  Employee,
  EmployeeStatus,
  TimeOff,
  TimeOffStatus,
  TimeOffType,
} from './entities';

export interface IDepartmentStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<Department | null>;
  findByName(tenantId: string, name: string, session?: TxSession): Promise<Department | null>;
  list(tenantId: string, page: number, limit: number): Promise<{
    data: Department[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  create(data: { tenantId: string; name: string; description?: string; createdBy: string }, session?: TxSession): Promise<Department>;
  update(tenantId: string, id: string, patch: { name?: string; description?: string; status?: DepartmentStatus }, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Department | null>;
  countActiveEmployees(tenantId: string, departmentId: string, session?: TxSession): Promise<number>;
}

export interface EmployeeFilters {
  search?: string;
  departmentId?: string;
  status?: EmployeeStatus;
}

export interface IEmployeeStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<Employee | null>;
  findByUserId(tenantId: string, userId: string, session?: TxSession): Promise<Employee | null>;
  findByCode(tenantId: string, code: string, session?: TxSession): Promise<Employee | null>;
  list(tenantId: string, filters: EmployeeFilters, page: number, limit: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
    data: Employee[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  create(data: { tenantId: string; code: string; firstName: string; lastName: string; userId?: string; email?: string; phone?: string; departmentId?: string; position?: string; location?: string; hireDate?: string; createdBy: string }, session?: TxSession): Promise<Employee>;
  update(tenantId: string, id: string, patch: { firstName?: string; lastName?: string; userId?: string | null; email?: string | null; phone?: string | null; departmentId?: string | null; position?: string | null; location?: string | null; hireDate?: string | null; status?: EmployeeStatus }, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Employee | null>;
}

/** Minimal Identity lookup; an employee link is never inferred from an email address. */
export interface IEmployeeUserDirectory {
  isActiveInTenant(tenantId: string, userId: string): Promise<boolean>;
}

export interface TimeOffFilters {
  employeeId?: string;
  status?: TimeOffStatus;
  type?: TimeOffType;
}

export interface ITimeOffStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<TimeOff | null>;
  list(tenantId: string, filters: TimeOffFilters, page: number, limit: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
    data: TimeOff[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  create(data: { tenantId: string; employeeId: string; type: TimeOffType; startDate: string; endDate: string; reason?: string; createdBy: string }, session?: TxSession): Promise<TimeOff>;
  decide(tenantId: string, id: string, to: TimeOffStatus, expectedVersion: number, decidedBy: string, session?: TxSession): Promise<TimeOff | null>;
  cancel(tenantId: string, id: string, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<TimeOff | null>;
}
