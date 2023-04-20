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

import { MyQuery, MyDataSourceOptions, DEFAULT_QUERY } from './types';

// proxy route
const routePath = '/graphql';
export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url: string;
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    // proxy url
    this.url = instanceSettings.url || '';
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { range } = options;
    console.log(options);
    const from = range!.from.valueOf();
    const to = range!.to.valueOf();

    // Return a constant for each query.
    const data = options.targets.map(async (target) => {
      const query = defaults(target, DEFAULT_QUERY);
      const dataQuery = getTemplateSrv().replace(query.queryText, options.scopedVars);
      const  s =  {
        query: "query queryServices($duration: Duration!,$keyword: String!) {\n    services: getAllServices(duration: $duration, group: $keyword) {\n      key: id\n      label: name\n      group\n    }\n  }",
        variables: {"duration":{"start":"2023-04-17 1503","end":"2023-04-17 1603","step":"MINUTE"},"keyword":""},
      };
      const t = {
        query: "query queryData($duration: Duration!, $serviceIds: [ID!]!) {\n  topology: getServicesTopology(duration: $duration, serviceIds: $serviceIds) {\n    nodes {\n      id\n      name\n      type\n      isReal\n    }\n    calls {\n      id\n      source\n      detectPoints\n      target\n    }\n  }}",
        variables: {"duration":{"start":"2023-04-17 1503","end":"2023-04-17 1603","step":"MINUTE"},"serviceIds":["YWdlbnQ6OnNvbmdz.1","YWdlbnQ6OnJlY29tbWVuZGF0aW9u.1","YWdlbnQ6OmFwcA==.1","YWdlbnQ6OmdhdGV3YXk=.1","YWdlbnQ6OmZyb250ZW5k.1"]},
      };
      // fetch services from api
      const services = await this.doRequest(s);
      // fetch topology data from api
      const topology = await this.doRequest(t);
      return new MutableDataFrame({
        refId: target.refId,
        fields: [
          { name: 'Time', values: [from, to], type: FieldType.time },
          { name: 'Value', values: [target.constant, target.constant], type: FieldType.number },
        ],
      });
    });

    return { data };
  }
  async doRequest(params?: Record<string, any>) {
    // Do the request on proxy; the server will replace url + routePath with the url
    // defined in plugin.json
    const result = getBackendSrv().fetch({
      method: 'POST',
      url: `${this.url}${routePath}`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: params,
    });
    console.log(result);
    return result;
  }

  async testDatasource() {
    // Implement a health check for your data source.
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
