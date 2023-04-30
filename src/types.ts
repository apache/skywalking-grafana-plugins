import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MyQuery extends DataQuery {
  service?: string;
  layer?: string;
  nodeMetrics?: string;
  edgeServerMetrics?: string;
  edgeClientMetrics?: string;
}

export const DEFAULT_QUERY: Partial<MyQuery> = {};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  path?: string;
  URL: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}

export type DurationTime = {
  start: string;
  end: string;
  step: string;
}

export type MetricData = {
  name: string;
  unit: string;
  label: string;
  calculation: string;
}
