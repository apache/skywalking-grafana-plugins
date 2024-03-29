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

import defaults from 'lodash/defaults';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  ArrayVector,
  NodeGraphDataFrameFieldNames,
} from '@grafana/data';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import {
  MyQuery,
  MyDataSourceOptions,
  DEFAULT_QUERY,
  DurationTime,
  MetricData,
  Call,
  Node,
  Recordable
} from './types';
import { Fragments, RoutePath, TimeType, Calculations } from './constant';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  URL: string;
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    // proxy url
    this.URL = instanceSettings.url || '';
    dayjs.extend(utc)
    dayjs.extend(timezone)
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { range } = options;
    const from = range!.from.valueOf();
    const to = range!.to.valueOf();
    const  v =  {
      query: Fragments.utc,
      variables: {},
    };
    const resp = await this.doRequest(v);
    const utc = resp.data.getTimeInfo.timezone / 100;
    const dates = this.timeFormat([this.getLocalTime(utc, new Date(from)), this.getLocalTime(utc, new Date(to))]);
    const duration = {
      start: this.dateFormatStep(dates.start, dates.step),
      end: this.dateFormatStep(dates.end, dates.step),
      step: dates.step,
    };
    const promises = options.targets.map(async (target) => {
      const query = defaults(target, DEFAULT_QUERY);
      const layer = getTemplateSrv().replace(query.layer, options.scopedVars);
      const serviceName = getTemplateSrv().replace(query.service, options.scopedVars);
      if (!layer && !serviceName) {
        return [];
      }
      const nodeMetricsStr = getTemplateSrv().replace(query.nodeMetrics, options.scopedVars);
      const nodeMetrics = nodeMetricsStr ? this.parseMetrics(nodeMetricsStr) : [];
      const edgeMetricsStr = getTemplateSrv().replace(query.edgeMetrics, options.scopedVars);
      const edgeMetrics = edgeMetricsStr ? this.parseMetrics(edgeMetricsStr) : [];
      let services = [];
      // fetch services from api
      const  s =  {
        query: Fragments.services,
        variables: {duration, keyword: ''},
      };
      const resp = await this.doRequest(s);
      services = resp.data.services || [];

      const t: {
        query: string;
        variables: Recordable;
      } = {
        query: Fragments.servicesTopolgy,
        variables: { duration },
      };
      let serviceObj;
      if (serviceName) {
        serviceObj = services.filter((d: {name: string, id: string}) => d.name === serviceName);
      } else {
        serviceObj = services.filter((d: {layers: string[], id: string}) => d.layers.includes(layer));
      }
      t.variables.serviceIds = serviceObj.map((d: {layers: string[], id: string}) => d.id);
      // fetch topology data from api
      const res = await this.doRequest(t);
      if (!res.data.topology) {
        throw new Error('Layer or service is not found');
      }
      const {nodes, calls} = this.setTopologyData({nodes: res.data.topology.nodes || [],  calls: res.data.topology.calls || []});
      const idsS = calls.filter((i: Call) => i.detectPoints.includes('SERVER')).map((b: Call) => b.id);
      const idsC = calls.filter((i: Call) => i.detectPoints.includes('CLIENT')).map((b: Call) => b.id);
      const serverMetrics = [];
      const clientMetrics = [];
      for (const m of edgeMetrics) {
        if (m.type === 'SERVER') {
          serverMetrics.push(m);
        } else {
          clientMetrics.push(m);
        }
      }
      const ids = nodes.map((d: Node) => d.id);
      // fetch topology metrics from api
      const nodeMetricsResp = nodeMetrics.length ? await this.queryMetrics(nodeMetrics, ids, duration) : null;
      const edgeServerMetricsResp = serverMetrics.length && idsS.length ? await this.queryMetrics(serverMetrics, idsS, duration) : null;
      const edgeClientMetricsResp = clientMetrics.length && idsC.length ? await this.queryMetrics(clientMetrics, idsC, duration) : null;
      const edgeMetricsResp: any = (edgeServerMetricsResp || edgeClientMetricsResp) ? {
        data: {...(edgeServerMetricsResp && edgeServerMetricsResp.data || {}), ...(edgeClientMetricsResp && edgeClientMetricsResp.data || {})}
      } : null;
      const fieldTypes = this.setFieldTypes({
        nodes,
        calls,
        nodeMetrics: nodeMetricsResp ? {...nodeMetricsResp, config: nodeMetrics} : undefined,
        edgeMetrics: edgeMetricsResp ? {...edgeMetricsResp, config: edgeMetrics} : undefined,
      });
      const nodeFrame =  new MutableDataFrame({
        name: 'Nodes',
        refId: target.refId,
        fields: fieldTypes.nodeFieldTypes,
        meta: {
          preferredVisualisationType: 'nodeGraph',
        }
      });
      const edgeFrame =  new MutableDataFrame({
        name: 'Edges',
        refId: target.refId,
        fields: fieldTypes.edgeFieldTypes,
        meta: {
          preferredVisualisationType: 'nodeGraph',
        }
      });

      return [nodeFrame, edgeFrame];
    });

    return Promise.all(promises).then(data => ({ data: data[0] }));
  }

  async doRequest(params?: Recordable) {
    // Do the request on proxy; the server will replace url + routePath with the url
    // defined in plugin.json
    const result = getBackendSrv().post(`${this.URL}${RoutePath}`, params);

    return result;
  }

  parseMetrics(params: string) {
    const regex = /{[^}]+}/g;
    const arr = params.match(regex);
    const metrics = arr?.map((d: string) => JSON.parse(d)) || [];

    return metrics;
  }

  async queryMetrics(params: MetricData[], ids: string[], duration: DurationTime) {
    const names = params.map((d: MetricData) => d.name);
    const m = this.queryTopologyMetrics(names, ids, duration);
    const metricJson = await this.doRequest(m);

    return metricJson;
  }

  setTopologyData(params: {nodes: Node[], calls: Call[]}) {
    if (!(params.nodes.length && params.calls.length)) {
      return {nodes: [], calls: []}
    }
    const obj = {} as Recordable;
      const nodes = (params.nodes || []).reduce((prev: Node[], next: Node) => {
        if (!obj[next.id]) {
          obj[next.id] = true;
          prev.push(next);
        }
        return prev;
      }, []);
      const calls = (params.calls || []).reduce((prev: Call[], next: Call) => {
        if (!obj[next.id]) {
          obj[next.id] = true;
          prev.push(next);
        }
        return prev;
      }, []);
      return {nodes, calls}
  }

  setFieldTypes(params: {nodes: Node[], calls: Call[], nodeMetrics: Recordable, edgeMetrics: Recordable}) {
    const nodeMetrics = params.nodeMetrics || {config: [], data: {}};
    const edgeMetrics = params.edgeMetrics || {config: [], data: {}};
    if (!(params.nodes && params.calls)) {
      return {nodeFieldTypes: [], edgeFieldTypes: []};;
    }
    const nodeFieldTypes = this.getNodeTypes(params.nodes || [], nodeMetrics);
    const edgeFieldTypes = this.getEdgeTypes(params.calls || [], edgeMetrics);

    return {nodeFieldTypes, edgeFieldTypes};
  }

  getNodeTypes(nodes: Node[], metrics: Recordable) {
    const idField = { name: NodeGraphDataFrameFieldNames.id, type: FieldType.string, values: new ArrayVector(), config: {}};
    const titleField = { name: NodeGraphDataFrameFieldNames.title, type: FieldType.string, values: new ArrayVector(), config: {}};
    const mainStatField = { name: NodeGraphDataFrameFieldNames.mainStat, type: FieldType.number, values: new ArrayVector(), config: {}};
    const secondaryStatField = { name: NodeGraphDataFrameFieldNames.secondaryStat, type: FieldType.number, values: new ArrayVector(), config: {}};
    const detailsFields: any = [];
    for (let i = 0; i < metrics.config.length; i++) {
      const c = metrics.config[i];
      const config = {displayName: c.label, unit: c.unit};
      if (i === 0) {
        mainStatField.config = config;
      } else if (i === 1) {
        secondaryStatField.config = config;
      } else {
        detailsFields.push({
          name: `${NodeGraphDataFrameFieldNames.detail}${c.name}`,
          type: FieldType.number,
          values: new ArrayVector(),
          config: {displayName: `${c.label || c.name } ${c.unit || ''}`}
        });
      }
    }
    for (const node of nodes) {
      idField.values.add(node.id || '');
      titleField.values.add(node.name);
      for (let i = 0; i < metrics.config.length; i++) {
        const item = metrics.config[i];
        const m = (metrics.data[item.name].values).find((v: {id: string}) => v.id === node.id) || {isEmptyValue: true};
        const value = m.isEmptyValue ? NaN : this.expression(Number(m.value), item.calculation);
        if(i > 1) {
          detailsFields[i - 2]?.values.add(Number(value));
        } else {
          if (i === 0) {
            mainStatField.values.add(Number(value));
          }
          if (i === 1) {
            secondaryStatField.values.add(Number(value));
          }
        }
      }
    }

    return [idField, titleField, mainStatField, secondaryStatField, ...detailsFields];
  }

  getEdgeTypes(calls: Call[], metrics: Recordable) {
    const idField = { name: NodeGraphDataFrameFieldNames.id, type: FieldType.string, values: new ArrayVector(), config: {}};
    const targetField = { name: NodeGraphDataFrameFieldNames.target, type: FieldType.string, values: new ArrayVector(), config: {}};
    const sourceField = { name: NodeGraphDataFrameFieldNames.source, type: FieldType.string, values: new ArrayVector(), config: {}};
    const mainStatField = { name: NodeGraphDataFrameFieldNames.mainStat, type: FieldType.number, values: new ArrayVector(), config: {}};
    const secondaryStatField = { name: NodeGraphDataFrameFieldNames.secondaryStat, type: FieldType.number, values: new ArrayVector(), config: {}};
    const detailsFields: any = [];

    for (let i = 0; i < metrics.config.length; i++) {
      const k = metrics.config[i];
      const config = {displayName: k.label, unit: k.unit};
      if (i === 0) {
        mainStatField.config = config;
      }
      else if (i === 1) {
        secondaryStatField.config = config;
      } else {
        detailsFields.push({
          name: `${NodeGraphDataFrameFieldNames.detail}${k.name}`,
          type: FieldType.number,
          values: new ArrayVector(),
          config: {displayName: `${k.label || k.name } ${k.unit || ''}`}
        });
      }
    }
    for (const call of calls) {
      idField.values.add(call.id);
      targetField.values.add(call.target);
      sourceField.values.add(call.source);
      for (let i = 0; i < metrics.config.length; i++) {
        const item = metrics.config[i];
        const m = (metrics.data[item.name].values).find((v: {id: string}) => v.id === call.id) || {isEmptyValue: true};
        const value = m.isEmptyValue ? NaN : this.expression(Number(m.value), item.calculation);

        if (i === 0) {
          mainStatField.values.add(Number(value));
        } else if (i === 1) {
          secondaryStatField.values.add(Number(value));
        } else {
          detailsFields[i - 2]?.values.add(Number(value));
        }
      }
    }

    return [idField, targetField, sourceField, mainStatField, secondaryStatField, ...detailsFields];
  }

  expression(val: number, calculation: string): number | string {
    let data: number | string = Number(val);
  
    switch (calculation) {
      case Calculations.Percentage:
        data = (val / 100).toFixed(2);
        break;
      case Calculations.PercentageAvg:
        data = (val / 100).toFixed(2);
        break;
      case Calculations.ByteToKB:
        data = (val / 1024).toFixed(2);
        break;
      case Calculations.ByteToMB:
        data = (val / 1024 / 1024).toFixed(2);
        break;
      case Calculations.ByteToGB:
        data = (val / 1024 / 1024 / 1024).toFixed(2);
        break;
      case Calculations.Apdex:
        data = (val / 10000).toFixed(2);
        break;
      case Calculations.ConvertSeconds:
        data = dayjs(val * 1000).format('YYYY-MM-DD HH:mm:ss');
        break;
      case Calculations.ConvertMilliseconds:
        data = dayjs(val).format('YYYY-MM-DD HH:mm:ss');
        break;
      case Calculations.MsToS:
        data = (val / 1000).toFixed(2);
        break;
      case Calculations.SecondToDay:
        data = (val / 86400).toFixed(2);
        break;
      case Calculations.NanosecondToMillisecond:
        data = (val / 1000 / 1000).toFixed(2);
        break;
      case Calculations.ApdexAvg:
        data = (val / 10000).toFixed(2);
        break;
      default:
        data = data;
        break;
    }
  
    return data;
  }

  queryTopologyMetrics(metrics: string[], ids: string[], duration: DurationTime) {
    const conditions: { [key: string]: unknown } = {
      duration,
      ids,
    };
    const variables: string[] = [`$duration: Duration!`, `$ids: [ID!]!`];
    const fragmentList = metrics.map((d: string, index: number) => {
      conditions[`m${index}`] = d;
      variables.push(`$m${index}: String!`);

      return `${d}: getValues(metric: {
        name: $m${index}
        ids: $ids
      }, duration: $duration) {
        values {
          id
          value
        }
      }`;
    });
    const query = `query queryData(${variables}) {${fragmentList.join(" ")}}`;

    return { query, variables: conditions };
  }

  timeFormat(time: Date[]) {
    let step: TimeType;
    const unix = Math.round(time[1].getTime()) - Math.round(time[0].getTime());
    if (unix <= 60 * 60 * 1000) {
      step = TimeType.MINUTE_TIME;
    } else if (unix <= 24 * 60 * 60 * 1000) {
      step = TimeType.HOUR_TIME;
    } else {
      step = TimeType.DAY_TIME;
    }
    return { start: time[0], end: time[1], step };
  }

  dateFormatStep(date: Date, step: string, monthDayDiff?: boolean): string {
    const year = date.getFullYear();
    const monthTemp = date.getMonth() + 1;
    let month = `${monthTemp}`;
    if (monthTemp < 10) {
      month = `0${monthTemp}`;
    }
    if (step === 'MONTH' && monthDayDiff) {
      return `${year}-${month}`;
    }
    const dayTemp = date.getDate();
    let day = `${dayTemp}`;
    if (dayTemp < 10) {
      day = `0${dayTemp}`;
    }
    if (step === 'DAY' || step === 'MONTH') {
      return `${year}-${month}-${day}`;
    }
    const hourTemp = date.getHours();
    let hour = `${hourTemp}`;
    if (hourTemp < 10) {
      hour = `0${hourTemp}`;
    }
    if (step === 'HOUR') {
      return `${year}-${month}-${day} ${hour}`;
    }
    const minuteTemp = date.getMinutes();
    let minute = `${minuteTemp}`;
    if (minuteTemp < 10) {
      minute = `0${minuteTemp}`;
    }
    if (step === 'MINUTE') {
      return `${year}-${month}-${day} ${hour}${minute}`;
    }
    const secondTemp = date.getSeconds();
    let second = `${secondTemp}`;
    if (secondTemp < 10) {
      second = `0${secondTemp}`;
    }
    if (step === 'SECOND') {
      return `${year}-${month}-${day} ${hour}${minute}${second}`;
    }
    return '';
  }
  getLocalTime(utc: number, time: Date): Date {
    const d = new Date(time);
    const len = d.getTime();
    const offset = d.getTimezoneOffset() * 60000;
    const utcTime = len + offset;

    return new Date(utcTime + 3600000 * utc);
  }
  async testDatasource() {
    // Implement a health check for your data source.
    const defaultErrorMessage = 'Cannot connect to API';
    try {
      const  v =  {
        query: Fragments.version,
        variables: {},
      };
      const resp = await this.doRequest(v);
    
      if (resp.data && resp.data.version !== undefined) {
        return {
          status: 'success',
          message: 'Success',
        };
      } else {
        return {
          status: 'error',
          message: resp.statusText ? resp.statusText : defaultErrorMessage,
        };
      }
    } catch(err: any) {
      const toString = Object.prototype.toString;
      if (toString.call(err) === `[object String]`) {
        return {
          status: 'error',
          message: err,
        };
      } else {
        let message = '';
        message += err.statusText ? err.statusText : defaultErrorMessage;
        if (err.data && err.data.error && err.data.error.code) {
          message += ': ' + err.data.error.code + '. ' + err.data.error.message;
        }

        return {
          status: 'error',
          message,
        };
      }
    }
  }
}
