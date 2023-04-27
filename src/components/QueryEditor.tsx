import React, { ChangeEvent } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery } from '../types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const onServiceChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, service: event.target.value });
  };
  const onLayerChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, layer: event.target.value });
  };
  const onNodeMetricsChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, nodeMetrics: event.target.value });
  };
  const onEdgeServerMetricsChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, edgeServerMetrics: event.target.value });
  };
  const onEdgeClientMetricsChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, edgeClientMetrics: event.target.value });
  };
  const onRunQueryText = () => {
    onRunQuery();
  };
  const { service, layer, nodeMetrics, edgeServerMetrics, edgeClientMetrics } = query;

  return (
    <div className="gf-form-group">
      <InlineField label="Service"  tooltip="Not used yet" labelWidth={20}>
        <Input onBlur={onRunQueryText} onChange={onServiceChange} value={service || ''} width={40} />
      </InlineField>
      <InlineField label="Layer"  tooltip="Not used yet" labelWidth={20}>
        <Input onBlur={onRunQueryText} onChange={onLayerChange} value={layer || ''} width={40} />
      </InlineField>
      <InlineField label="Node Metrics"  tooltip="Not used yet" labelWidth={20}>
        <Input onBlur={onRunQueryText} onChange={onNodeMetricsChange} value={nodeMetrics || ''} width={60} />
      </InlineField>
      <InlineField label="Edge Server Metrics"  tooltip="Not used yet" labelWidth={20}>
          <Input onBlur={onRunQueryText} onChange={onEdgeServerMetricsChange} value={edgeServerMetrics || ''} width={60} />
        </InlineField>
      <InlineField label="Edge Client Metrics"  tooltip="Not used yet" labelWidth={20}>
        <Input onBlur={onRunQueryText} onChange={onEdgeClientMetricsChange} value={edgeClientMetrics || ''} width={60} />
      </InlineField>
    </div> 
  );
}
