import React, { ChangeEvent } from 'react';
import { InlineField, Input, Alert } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery } from '../types';

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
        return;
      }
      onRunQuery();
    } catch(e) {
      console.error(e);
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
      <InlineField label="Node Metrics"  tooltip="Not used yet" labelWidth={20}>
        <Input onBlur={onRunQueryText} onChange={onNodeMetricsChange} value={nodeMetrics || ''} width={60} />
      </InlineField>
      <InlineField label="Edge Metrics"  tooltip="Not used yet" labelWidth={20}>
        <Input onBlur={onRunQueryText} onChange={onEdgeMetricsChange} value={edgeMetrics || ''} width={60} />
      </InlineField>
    </div> 
  );
}
