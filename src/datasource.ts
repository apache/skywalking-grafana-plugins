import defaults from 'lodash/defaults';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  FieldColorModeId,
} from '@grafana/data';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

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
import {Fragments, RoutePath, TimeType, Calculations } from "./constant";

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
    let utc = -(new Date().getTimezoneOffset() / 60);

    if (options.timezone !== "browser") {
      utc = dayjs().tz(options.timezone).utcOffset() / 60;
    }
    const dates = this.timeFormat([this.getLocalTime(utc, new Date(from)), this.getLocalTime(utc, new Date(to))]);
    const duration = {
      start: this.dateFormatStep(dates.start, dates.step),
      end: this.dateFormatStep(dates.end, dates.step),
      step: dates.step,
    };
    const promises = options.targets.map(async (target) => {
      const query = defaults(target, DEFAULT_QUERY);
      const serviceName = getTemplateSrv().replace(query.service, options.scopedVars);
      const nodeMetricsStr = getTemplateSrv().replace(query.nodeMetrics, options.scopedVars);
      const nodeMetrics = nodeMetricsStr ? this.parseMetrics(nodeMetricsStr) : [];
      const edgeServerMetricsStr = getTemplateSrv().replace(query.edgeServerMetrics, options.scopedVars);
      const edgeServerMetrics = edgeServerMetricsStr ? this.parseMetrics(edgeServerMetricsStr) : [];
      const edgeClientMetricsStr = getTemplateSrv().replace(query.edgeClientMetrics, options.scopedVars);
      const edgeClientMetrics = edgeClientMetricsStr ? this.parseMetrics(edgeClientMetricsStr) : [];
      let services = [];
      let t: {
        query: string;
        variables: Recordable;
      } = {
        query: Fragments.globalTopology,
        variables: {duration},
      };
      let serviceObj;
      // fetch services from api
      const  s =  {
        query: Fragments.services,
        variables: {duration, keyword: ""},
      };
      const resp = await this.doRequest(s);
      services = resp.data.services || [];
      if (serviceName) {
        serviceObj = services.find((d: {name: string, id: string}) => d.name === serviceName);
        if(serviceObj) {
          t = {
            query: Fragments.serviceTopolgy,
            variables: {serviceId: serviceObj.id, duration},
          };
        }
      }

      // fetch topology data from api
      const res = await this.doRequest(t);
      const {nodes, calls} = this.setTopologyData({nodes: res.data.topology.nodes || [],  calls: res.data.topology.calls || []});
      const idsS = calls.filter((i: Call) => i.detectPoints.includes("SERVER")).map((b: Call) => b.id);
      const idsC = calls.filter((i: Call) => i.detectPoints.includes("CLIENT")).map((b: Call) => b.id);
      const ids = nodes.map((d: Node) => d.id);
      // fetch topology metrics from api
      const nodeMetricsResp = nodeMetrics.length ? await this.queryMetrics(nodeMetrics, ids, duration) : null;
      const edgeServerMetricsResp = edgeServerMetrics.length && idsS.length ? await this.queryMetrics(edgeServerMetrics, idsS, duration) : null;
      const edgeClientMetricsResp = edgeClientMetrics.length && idsC.length ? await this.queryMetrics(edgeClientMetrics, idsC, duration) : null;
      const topology = this.setTopologyMetrics({
        nodes,
        calls,
        nodeMetrics: nodeMetricsResp ? {...nodeMetricsResp, config: nodeMetrics} : undefined,
        edgeServerMetrics: edgeServerMetricsResp ? {...edgeServerMetricsResp, config: nodeMetrics} : undefined,
        edgeClientMetrics: edgeClientMetricsResp ? {...edgeClientMetricsResp, config: nodeMetrics} : undefined,
      });
      const {nodeFieldTypes, edgeServerFieldTypes, edgeClientFieldTypes} = this.setFieldTypes({
        nodeMetrics: nodeMetricsResp ? nodeMetricsResp.data : undefined,
        edgeServerMetrics: edgeServerMetricsResp ? edgeServerMetricsResp.data : undefined,
        edgeClientMetrics: edgeClientMetricsResp ? edgeClientMetricsResp.data : undefined,
      });
      console.log(topology);
      const nodeFrame =  new MutableDataFrame({
        name: 'Nodes',
        refId: target.refId,
        fields: [
          { name: 'id', type: FieldType.string },
          { name: 'title', type: FieldType.string },
          ...nodeFieldTypes
        ],
        meta: {
          preferredVisualisationType: 'nodeGraph',
        }
      });
      const edgeFrame =  new MutableDataFrame({
        name: 'Edges',
        refId: target.refId,
        fields: [
          { name: 'id', type: FieldType.string },
          { name: 'source', type: FieldType.string },
          { name: 'target', type: FieldType.string },
          ...edgeServerFieldTypes,
          ...edgeClientFieldTypes,
        ],
        meta: {
          preferredVisualisationType: 'nodeGraph',
        }
      });
      for (const node of nodes) {
        nodeFrame.add({...node, title: node.name});
      }
      for (const call of calls) {
        edgeFrame.add(call);
      }
      return [nodeFrame, edgeFrame];
    });

    return Promise.all(promises).then(data => ({ data: data[0] }));
  }

  async doRequest(params?: Recordable) {
    // Do the request on proxy; the server will replace url + routePath with the url
    // defined in plugin.json
    const result = getBackendSrv().post(`${this.URL}${RoutePath}`, params, {headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic c2t5d2Fsa2luZzpza3l3YWxraW5n',
    } });

    return result;
  }

  parseMetrics(params: string) {
    const regex = /{[^}]+}/g;
    const arr = params.match(regex);
    const metrics = arr?.map((d: string) => JSON.parse(d)) || [];

    return metrics;
  }

  async queryMetrics(params: any[], ids: string[], duration: DurationTime) {
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

  setFieldTypes(params: {nodeMetrics: Recordable, edgeServerMetrics: Recordable, edgeClientMetrics: Recordable}) {
    const nodeMetrics = params.nodeMetrics || {};
    const edgeServerMetrics = params.edgeServerMetrics || {};
    const edgeClientMetrics = params.edgeClientMetrics || {};
    const nodeFieldTypes = this.getTypes(nodeMetrics, 'node');
    const edgeServerFieldTypes = this.getTypes(edgeServerMetrics, 'edgeS');
    const edgeClientFieldTypes = this.getTypes(edgeClientMetrics, 'edgeC');

    return {nodeFieldTypes, edgeServerFieldTypes, edgeClientFieldTypes};
  }

  getTypes(metrics: Recordable, type: string) {
    const types = Object.keys(metrics).map((k: string, index: number) => {
      if (type === 'edgeC') {
        return { name: `detail__${k}`, type: FieldType.number, config: {displayName: k} };;
      }
      if (index === 0) {
        return { name: 'mainstat', type: FieldType.number, config: {} };
      }
      if (index === 1) {
        return { name: 'secondarystat', type: FieldType.number, config: {} };
      }
      if (type === 'edgeS') {
        return { name: `detail__${k}`, type: FieldType.number, config: {displayName: k} };;
      }
      return { name: `arc__${k}`, type: FieldType.number, config: {fixedColor: 'green', mode: FieldColorModeId.Fixed} };
    });

    return types;
  }

  setTopologyMetrics(params: {nodes: Node[], calls: Call[], nodeMetrics: Recordable, edgeServerMetrics: Recordable, edgeClientMetrics: Recordable}) {
    const nodeMetrics = params.nodeMetrics || {config: [], data: {}};
    const edgeServerMetrics = params.edgeServerMetrics || {config: [], data: {}};
    const edgeClientMetrics = params.edgeClientMetrics || {config: [], data: {}};
    const nodes = params.nodes.map((next: Node) => {
      for (const [index, k] of Object.keys(nodeMetrics.data).entries()) {
        const c = nodeMetrics.config.find((d: MetricData) => d.name === k) || {};
        const m = (nodeMetrics.data[k].values).find((v: {id: string}) => v.id === next.id) || {isEmptyValue: true};
        const value = m.isEmptyValue ? NaN : this.expression(Number(m.value), c.calculation);
        if (index === 0) {
          next.mainstat = value;
        } else if (index === 1) {
          next.secondarystat = value;
        } else {
          next[`arc__${k}`] = value;
        }
      }
      return next;
    })
    const calls = params.calls.map((next: Call) => {
      for (const [index, k] of Object.keys(edgeServerMetrics.data).entries()) {
        const c = edgeServerMetrics.config.find((d: MetricData) => d.name === k) || {};
        const m = (edgeServerMetrics.data[k].values).find((v: {id: string}) => v.id === next.id) || {value: NaN};
        const value = m.isEmptyValue ? NaN : this.expression(Number(m.value), c.calculation);
        if (index === 0) {
          next.mainstat = value;
        } else if (index === 1) {
          next.secondarystat = value;
        } else {
          next[`detail__${k}`] = value;
        }
      }
      for (const k of Object.keys(edgeClientMetrics.data)) {
        const c = edgeClientMetrics.config.find((d: MetricData) => d.name === k) || {};
        const m = (edgeClientMetrics.data[k].values).find((v: {id: string}) => v.id === next.id) || {value: NaN};
        const value = m.isEmptyValue ? NaN : this.expression(Number(m.value), c.calculation);
        next[`detail__${k}`] = value;
      }
      return next;
    })

    return {nodes, calls}
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
        data = dayjs(val * 1000).format("YYYY-MM-DD HH:mm:ss");
        break;
      case Calculations.ConvertMilliseconds:
        data = dayjs(val).format("YYYY-MM-DD HH:mm:ss");
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
    if (step === "MONTH" && monthDayDiff) {
      return `${year}-${month}`;
    }
    const dayTemp = date.getDate();
    let day = `${dayTemp}`;
    if (dayTemp < 10) {
      day = `0${dayTemp}`;
    }
    if (step === "DAY" || step === "MONTH") {
      return `${year}-${month}-${day}`;
    }
    const hourTemp = date.getHours();
    let hour = `${hourTemp}`;
    if (hourTemp < 10) {
      hour = `0${hourTemp}`;
    }
    if (step === "HOUR") {
      return `${year}-${month}-${day} ${hour}`;
    }
    const minuteTemp = date.getMinutes();
    let minute = `${minuteTemp}`;
    if (minuteTemp < 10) {
      minute = `0${minuteTemp}`;
    }
    if (step === "MINUTE") {
      return `${year}-${month}-${day} ${hour}${minute}`;
    }
    const secondTemp = date.getSeconds();
    let second = `${secondTemp}`;
    if (secondTemp < 10) {
      second = `0${secondTemp}`;
    }
    if (step === "SECOND") {
      return `${year}-${month}-${day} ${hour}${minute}${second}`;
    }
    return "";
  }
  getLocalTime(utc: number, time: Date): Date {
    const d = new Date(time);
    const len = d.getTime();
    const offset = d.getTimezoneOffset() * 60000;
    const utcTime = len + offset;

    return new Date(utcTime + 3600000 * utc);
  };

  async testDatasource() {
    // Implement a health check for your data source.
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
