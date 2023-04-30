import defaults from 'lodash/defaults';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
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
import {Fragments, RoutePath, TimeType } from "./constant";

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
      const nodeMetrics = getTemplateSrv().replace(query.nodeMetrics, options.scopedVars);
      const edgeServerMetrics = getTemplateSrv().replace(query.edgeServerMetrics, options.scopedVars);
      const edgeClientMetrics = getTemplateSrv().replace(query.edgeClientMetrics, options.scopedVars);
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
      const nodeMetricsResp = nodeMetrics ? await this.parseMetrics(nodeMetrics, ids, duration) : null;
      const edgeServerMetricsResp = edgeServerMetrics && idsS.length ? await this.parseMetrics(edgeServerMetrics, idsS, duration) : null;
      const edgeClientMetricsResp = edgeClientMetrics && idsC.length ? await this.parseMetrics(edgeClientMetrics, idsC, duration) : null;
      const topology = this.setTopologyMetrics({
        nodes,
        calls,
        nodeMetrics: nodeMetricsResp ? nodeMetricsResp.data : undefined,
        edgeServerMetrics: edgeServerMetricsResp ? edgeServerMetricsResp.data : undefined,
        edgeClientMetrics: edgeClientMetricsResp ? edgeClientMetricsResp.data : undefined,
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

  async parseMetrics(params: string, ids: string[], duration: DurationTime) {
    const regex = /{[^}]+}/g;
    const arr = params.match(regex);
    const metrics = arr?.map((d: string) => JSON.parse(d)) || [];
    const names = metrics?.map((d: MetricData) => d.name);
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
    const nodeFieldTypes = this.getTypes(nodeMetrics);
    const edgeServerFieldTypes = this.getTypes(edgeServerMetrics);
    const edgeClientFieldTypes = this.getTypes(edgeClientMetrics);

    return {nodeFieldTypes, edgeServerFieldTypes, edgeClientFieldTypes};
  }

  getTypes(metrics: Recordable) {
    const types = Object.keys(metrics).map((k: string) => {
      return { name: `detail__${k}`, type: FieldType.number };
    });

    return types;
  }

  setTopologyMetrics(params: {nodes: Node[], calls: Call[], nodeMetrics: Recordable, edgeServerMetrics: Recordable, edgeClientMetrics: Recordable}) {
    const nodeMetrics = params.nodeMetrics || {};
    const edgeServerMetrics = params.edgeServerMetrics || {};
    const edgeClientMetrics = params.edgeClientMetrics || {};
    const nodes = params.nodes.map((next: Node) => {
      for (const k of Object.keys(nodeMetrics)) {
        const m = (nodeMetrics[k].values).find((v: {id: string}) => v.id === next.id) || {value: NaN};
        next[`detail__${k}`] = m.value;
      }
      return next;
    })
    const calls = params.calls.map((next: Call) => {
      for (const k of Object.keys(edgeServerMetrics)) {
        const m = (edgeServerMetrics[k].values).find((v: {id: string}) => v.id === next.id) || {value: NaN};
        next[`detail__${k}`] = m.value;
      }
      for (const k of Object.keys(edgeClientMetrics)) {
        const m = (edgeClientMetrics[k].values).find((v: {id: string}) => v.id === next.id) || {value: NaN};
        next[`detail__${k}`] = m.value;
      }
      return next;
    })
    
      return {nodes, calls}
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
