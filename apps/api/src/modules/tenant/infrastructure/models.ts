import mongoose, { Schema, type Model } from 'mongoose';

export interface TenantDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'DISABLED';
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<TenantDoc>(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'DISABLED'],
      default: 'ACTIVE',
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
    updatedBy: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: 'version',
    optimisticConcurrency: true,
    collection: 'tenants',
  },
);

tenantSchema.index(
  { tenantId: 1 },
  { unique: true, name: 'uniq_tenant_id' },
);

tenantSchema.index(
  { slug: 1 },
  { unique: true, name: 'uniq_tenant_slug' },
);

function getOrCreate<T extends mongoose.Document>(
  name: string,
  schema: Schema<T>,
): Model<T> {
  return (
    mongoose.models[name] as Model<T> | undefined
  ) ?? mongoose.model<T>(name, schema);
}

export const TenantModel = getOrCreate<TenantDoc>(
  'Tenant',
  tenantSchema,
);

export const tenantModels = [
  TenantModel,
] as Array<import('mongoose').Model<unknown>>;
