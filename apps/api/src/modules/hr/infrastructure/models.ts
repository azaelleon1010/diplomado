/**
 * HR MongoDB models — Infrastructure layer.
 * Shared collections (never one collection per tenant).
 */
import mongoose, { Schema, type Model } from 'mongoose';
import { addTenantIndex, baseFields, baseOptions } from '@erp/database';

export interface DepartmentDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<DepartmentDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'departments' },
);
departmentSchema.index({ tenantId: 1, name: 1 }, { unique: true, name: 'uniq_tenant_department_name' });
addTenantIndex(departmentSchema);

export interface EmployeeDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
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
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<EmployeeDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    code: { type: String, required: true, trim: true, uppercase: true, minlength: 1, maxlength: 32 },
    firstName: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40 },
    departmentId: { type: String, trim: true },
    position: { type: String, trim: true, maxlength: 120 },
    location: { type: String, trim: true, maxlength: 200 },
    hireDate: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'], default: 'ACTIVE', index: true },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'employees' },
);
employeeSchema.index({ tenantId: 1, code: 1 }, { unique: true, name: 'uniq_tenant_employee_code' });
employeeSchema.index({ tenantId: 1, departmentId: 1 }, { name: 'idx_tenant_department' });
employeeSchema.index({ tenantId: 1, lastName: 1, firstName: 1 }, { name: 'idx_tenant_employee_name' });
addTenantIndex(employeeSchema);

export interface TimeOffDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  employeeId: string;
  type: 'VACATION' | 'SICK' | 'PERMISSION';
  startDate: string;
  endDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason?: string;
  decidedBy?: string;
  decidedAt?: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const timeOffSchema = new Schema<TimeOffDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    employeeId: { type: String, required: true, trim: true },
    type: { type: String, enum: ['VACATION', 'SICK', 'PERMISSION'], required: true },
    startDate: { type: String, required: true, trim: true },
    endDate: { type: String, required: true, trim: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PENDING', index: true },
    reason: { type: String, trim: true, maxlength: 1000 },
    decidedBy: { type: String, trim: true },
    decidedAt: { type: String, trim: true },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'timeOffs' },
);
timeOffSchema.index({ tenantId: 1, employeeId: 1, status: 1 }, { name: 'idx_tenant_employee_status' });
addTenantIndex(timeOffSchema);

function getOrCreate<T extends mongoose.Document>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const DepartmentModel = getOrCreate<DepartmentDoc>('HrDepartment', departmentSchema);
export const EmployeeModel = getOrCreate<EmployeeDoc>('HrEmployee', employeeSchema);
export const TimeOffModel = getOrCreate<TimeOffDoc>('HrTimeOff', timeOffSchema);

/** Models whose indexes must exist before the API serves traffic. */
export const hrModels = [DepartmentModel, EmployeeModel, TimeOffModel] as unknown as Array<import('mongoose').Model<unknown>>;
