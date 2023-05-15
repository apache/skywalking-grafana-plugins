/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface MyQuery extends DataQuery {
  layer?: string;
  service?: string;
  nodeMetrics?: string;
  edgeMetrics?: string;
}

export const DEFAULT_QUERY: Partial<MyQuery> = {};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  URL: string;
  username: string;
  type: string;
  basicAuth: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  password: string;
}

export type DurationTime = {
  start: string;
  end: string;
  step: string;
}

export type MetricData = {
  name: string;
  label: string;
  calculation: string;
  unit: string;
  type: string;
}

export type Recordable = Record<string, any>;

export interface Node extends Recordable {
  id: string;
  name: string;
  type: string;
  isReal: boolean;
  serviceName?: string;
}
export interface Call extends Recordable {
  source: string;
  target: string;
  id: string;
  detectPoints: string[];
  type?: string;
  sourceComponents: string[];
  targetComponents: string[];
}
