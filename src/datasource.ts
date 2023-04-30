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

import { MyQuery, MyDataSourceOptions, DEFAULT_QUERY, DurationTime, MetricData } from './types';
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
      let t: any = {
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

      const ids = serviceObj ? [serviceObj.id] : services.map((d: any) => d.id);
      // fetch topology data from api
      const res = await this.doRequest(t);

      // fetch topology metrics from api
      if (nodeMetrics) {
        await this.parseMetrics(nodeMetrics, ids, duration);
      }
      if (edgeServerMetrics) {
        await this.parseMetrics(edgeServerMetrics, ids, duration);
      }
      if (edgeClientMetrics) {
        await this.parseMetrics(edgeClientMetrics, ids, duration);
      }
      const nodes = res.data.topology.nodes || [];
      const calls = res.data.topology.calls || [];
      const nodeFrame =  new MutableDataFrame({
        name: 'Nodes',
        refId: target.refId,
        fields: [
          { name: 'id', type: FieldType.string },
          { name: 'title', type: FieldType.string },
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
        ],
        meta: {
          preferredVisualisationType: 'nodeGraph',
        }
      });
      for (const node of nodes) {
        nodeFrame.add({id: node.id, title: node.name});
      }
      for (const call of calls) {
        edgeFrame.add({id: call.id, target: call.target, source: call.source});
      }
      return [nodeFrame, edgeFrame];
    });

    return Promise.all(promises).then(data => ({ data: data[0] }));
  }

  async doRequest(params?: Record<string, any>) {
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
