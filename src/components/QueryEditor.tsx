import React, { ChangeEvent } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery } from '../types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, queryText: event.target.value });
  };
  const onRunQueryText = () => {
    onRunQuery();
  };
  const { queryText } = query;

  return (
    <div className="gf-form">
      <InlineField label="Query Text"  tooltip="Not used yet">
        <Input onBlur={onRunQueryText} onChange={onQueryTextChange} value={queryText || ''} width={40} />
      </InlineField>
    </div>
  );
}
