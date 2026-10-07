import { sqliteTable, text, integer, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const signals = sqliteTable('visitor_signals', {
  visitorKey: text('visitor_key').notNull(),
  kind: text('kind').notNull(),
  value: text('value').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [primaryKey({ columns: [table.visitorKey, table.kind] })]);

export const leads = sqliteTable('truck_requests', {
  id: text('id').primaryKey(),
  requestKey: text('request_key').notNull(),
  visitorKey: text('visitor_key').notNull(),
  intent: text('intent').notNull(),
  contactType: text('contact_type').notNull(),
  contactValue: text('contact_value').notNull(),
  consent: text('consent').notNull(),
  createdAt: text('created_at').notNull(),
  status: text('status').notNull().default('new'),
}, (table) => [uniqueIndex('idx_truck_requests_request_key').on(table.requestKey)]);

export const sightings = sqliteTable('truck_sightings', {
  id: text('id').primaryKey(),
  requestKey: text('request_key').notNull(),
  visitorKey: text('visitor_key').notNull(),
  objectKey: text('object_key').notNull(),
  viewKey: text('view_key').notNull(),
  byteSize: integer('byte_size').notNull(),
  createdAt: text('created_at').notNull(),
  licenseVersion: text('license_version'),
  licenseConfirmedAt: text('license_confirmed_at'),
}, (table) => [uniqueIndex('idx_truck_sightings_request_key').on(table.requestKey)]);

export const limits = sqliteTable('submission_limits', {
  key: text('key').primaryKey(),
  bucket: integer('bucket').notNull(),
  count: integer('count').notNull(),
}, (table) => [index('idx_submission_limits_bucket').on(table.bucket)]);

export const visits = sqliteTable('site_visits', {
  id: text('id').primaryKey(),
  visitorKey: text('visitor_key').notNull(),
  startedAt: text('started_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  referrerHost: text('referrer_host').notNull().default(''),
  device: text('device').notNull().default('unknown'),
}, (table) => [index('idx_site_visits_started_at').on(table.startedAt), index('idx_site_visits_last_seen_at').on(table.lastSeenAt)]);
