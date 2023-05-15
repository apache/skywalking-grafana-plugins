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
import { InlineField, SecretInput, Select, Input } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MyDataSourceOptions, MySecureJsonData } from '../types';
import { AuthenticationType } from "../constant";

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> {}

export function ConfigEditor(props: Props) {
  const { options, onOptionsChange } = props;

  const onURLChange = (event: ChangeEvent<HTMLInputElement>) => {
    const jsonData = {
      ...options.jsonData,
      URL: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  const onTypeChange = (v: any) => {
    const secureJsonData = (options.secureJsonData || {}) as MySecureJsonData;
    const jsonData = {
      ...options.jsonData,
      type: v.value,
      username: v.value === AuthenticationType[0].value ? options.jsonData.username : '',
    };
    let secureJson = {
      basicAuth: '',
      password: '',
    };
    if (v.value === AuthenticationType[0].value) {
      secureJson = {
        basicAuth: secureJsonData.basicAuth,
        password: secureJsonData.password,
      };
    }
    const p = { 
      ...options,
      jsonData,
      secureJsonData: secureJson,
    }
    onOptionsChange(p);
  };

  const onUserChange = (event: ChangeEvent<HTMLInputElement>) => {
    const secureJsonData = (options.secureJsonData || {}) as MySecureJsonData;
    const basicAuth = `Basic ${btoa(encodeURI(`${event.target.value}:${secureJsonData.password}`))}`;
    const jsonData = {
      ...options.jsonData,
      username: event.target.value,
    };

    onOptionsChange({ 
      ...options,
      jsonData,
      secureJsonData: {
        basicAuth,
      }
    });
  };

  const onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    const basicAuth = `Basic ${btoa(encodeURI(`${options.jsonData.username}:${event.target.value}`))}`;
    const jsonData = {
      ...options.jsonData,
    };

    onOptionsChange({ 
      ...options,
      jsonData,
      secureJsonData: {
        password: event.target.value,
        basicAuth,
      }
    });
  };

  const onResetAPIKey = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        basicAuth: false,
        password: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        basicAuth: '',
        password: '',
      },
    });
  };

  const secureJsonData = (options.secureJsonData || {}) as MySecureJsonData;
  const { secureJsonFields, jsonData } = options;

  return (
    <div className="gf-form-group">
      <InlineField label="URL" labelWidth={18}>
        <Input
          onChange={onURLChange}
          value={jsonData.URL || ''}
          placeholder="http://skywalking.example.com/graphql"
          width={40}
        />
      </InlineField>
      <InlineField label="Authentication Type" labelWidth={18} >
        <Select
          options={AuthenticationType}
          value={jsonData.type || AuthenticationType[1].value}
          onChange={onTypeChange}
          width={40}
          placeholder="Choose an authentication type"
          menuPlacement="bottom"
        />
      </InlineField>
      {jsonData.type === AuthenticationType[0].value &&
      <div>
        <InlineField label="User Name" labelWidth={18}>
        <Input
          onChange={onUserChange}
          value={jsonData.username || ''}
          placeholder="Please input username"
          width={40}
        />
      </InlineField>
      <InlineField label="Password" labelWidth={18}>
        <SecretInput
          isConfigured={(secureJsonFields && secureJsonFields.password) as boolean}
          type="password"
          value={secureJsonData.password || ''}
          placeholder="secure password field (backend only)"
          width={40}
          onReset={onResetAPIKey}
          onChange={onPasswordChange}
        />
      </InlineField>
    </div>}
    </div>
  );
}
