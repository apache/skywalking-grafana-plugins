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
import React, { ChangeEvent } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery } from '../types';
import {EdgeMetrics, NodeMetrics} from "../constant";

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const onLayerChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, layer: event.target.value });
  };
  const onServiceChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, service: event.target.value });
  };
  const onNodeMetricsChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, nodeMetrics: event.target.value });
  };
  const onEdgeMetricsChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, edgeMetrics: event.target.value });
  };
  const onRunQueryText = () => {
    try {
      const nodeMetrics = query.nodeMetrics && parseData(query.nodeMetrics) || [];
      const edgeMetrics = query.edgeMetrics && parseData(query.edgeMetrics) || [];

      const n = nodeMetrics.find((d: {name: string}) => !d.name);
      const e = edgeMetrics.find((d: {name: string, type: string}) => !(d.name && d.type));
      if (e || n) {
        throw new Error('Bad data');
      }
      onRunQuery();
    } catch(e) {
      throw new Error('Bad data');
    }
  };
  const parseData = (params: string) => {
    const regex = /{[^}]+}/g;
    const arr = params.match(regex);
    const metrics = arr?.map((d: string) => JSON.parse(d)) || [];

    return metrics;
  };
  const { service, nodeMetrics, edgeMetrics, layer } = query;

  return (
    <div className="gf-form-group">
      <InlineField label="Layer"  tooltip="Not used yet" labelWidth={20}>
        <Input onBlur={onRunQueryText} onChange={onLayerChange} value={layer || ''} width={40} />
      </InlineField>
      <InlineField label="Service"  tooltip="Not used yet" labelWidth={20}>
        <Input onBlur={onRunQueryText} onChange={onServiceChange} value={service || ''} width={40} />
      </InlineField>
      <InlineField label="Node Metrics"  tooltip={NodeMetrics} labelWidth={20}>
        <Input onBlur={onRunQueryText} onChange={onNodeMetricsChange} value={nodeMetrics || ''} width={60} />
      </InlineField>
      <InlineField label="Edge Metrics"  tooltip={EdgeMetrics} labelWidth={20}>
        <Input onBlur={onRunQueryText} onChange={onEdgeMetricsChange} value={edgeMetrics || ''} width={60} />
      </InlineField>
    </div> 
  );
}
