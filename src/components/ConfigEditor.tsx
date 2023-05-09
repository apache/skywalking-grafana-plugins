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
import { InlineField, Input, SecretInput } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MyDataSourceOptions, MySecureJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> {}

export function ConfigEditor(props: Props) {
  const { onOptionsChange, options } = props;
  const onPathChange = (event: ChangeEvent<HTMLInputElement>) => {
    const jsonData = {
      ...options.jsonData,
      path: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  // Secure field (only sent to the backend)
  const onAPIKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        apiKey: event.target.value,
      },
    });
  };

  const onResetAPIKey = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        apiKey: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        apiKey: '',
      },
    });
  };

  const onURLChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = props;
    const jsonData = {
      ...options.jsonData,
      URL: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  const { jsonData, secureJsonFields } = options;
  const secureJsonData = (options.secureJsonData || {}) as MySecureJsonData;

  return (
    <div className="gf-form-group">
      <InlineField label="URL" labelWidth={12}>
        <Input
          onChange={onURLChange}
          value={jsonData.URL || ''}
          placeholder="http://skywalking.example.com/graphql"
          width={40}
        />
      </InlineField>
      <InlineField label="Path" labelWidth={12}>
        <Input
          onChange={onPathChange}
          value={jsonData.path || ''}
          placeholder="json field returned to frontend"
          width={40}
        />
      </InlineField>
      <InlineField label="API Key" labelWidth={12}>
        <SecretInput
          isConfigured={(secureJsonFields && secureJsonFields.apiKey) as boolean}
          value={secureJsonData.apiKey || ''}
          placeholder="secure json field (backend only)"
          width={40}
          onReset={onResetAPIKey}
          onChange={onAPIKeyChange}
        />
      </InlineField>
    </div>
  );
}
