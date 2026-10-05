import { mapMongoError } from '@erp/database';
import type { ClientSession } from 'mongoose';
import type { ITenantStore, TxSession } from '../domain/ports';
import type { Tenant } from '../domain/entities';
import { TenantModel, type TenantDoc } from './models';

const oid = (value: unknown): string => String(value);

function toTenant(doc: TenantDoc): Tenant {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    name: doc.name,
    slug: doc.slug,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

export class MongoTenantStore implements ITenantStore {
  async findById(tenantId: string): Promise<Tenant | null> {
    try {
      const doc = await TenantModel.findOne({ tenantId }).exec();
      return doc ? toTenant(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async findBySlug(slug: string, session?: TxSession): Promise<Tenant | null> {
    try {
      const query = TenantModel.findOne({
        slug: slug.toLowerCase(),
      });
      if (session) query.session(session as ClientSession);

      const doc = await query.exec();

      return doc ? toTenant(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async create(data: {
    tenantId: string;
    name: string;
    slug: string;
    createdBy: string;
  }, session?: TxSession): Promise<Tenant> {
    try {
      const [created] = await TenantModel.create([{
        tenantId: data.tenantId,
        name: data.name,
        slug: data.slug.toLowerCase(),
        status: 'ACTIVE',
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
        version: 1,
      }], session ? { session: session as ClientSession } : {});

      return toTenant(created);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async setStatus(
    tenantId: string,
    status: Tenant['status'],
    updatedBy: string,
  ): Promise<Tenant | null> {
    try {
      const updated = await TenantModel.findOneAndUpdate(
        { tenantId },
        {
          $set: {
            status,
            updatedBy,
            updatedAt: new Date(),
          },
          $inc: {
            version: 1,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      ).exec();

      return updated ? toTenant(updated) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}
