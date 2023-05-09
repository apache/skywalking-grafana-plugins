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

export const Fragments = {
  servicesTopolgy: "query queryData($serviceIds: [ID!]!, $duration: Duration!) {\n  topology: getServicesTopology(serviceIds: $serviceIds, duration: $duration) {\n    nodes {\n      id\n      name\n      type\n      isReal\n    }\n    calls {\n      id\n      source\n      detectPoints\n      target\n    }\n  }}",
  services: "query queryServices($duration: Duration!,$keyword: String!) {\n    services: getAllServices(duration: $duration, group: $keyword) {\n      id\n      name\n      group\n      layers\n    }\n  }",
};

// proxy route
export const RoutePath = '/graphql';

export enum TimeType {
  MINUTE_TIME = "MINUTE",
  HOUR_TIME = "HOUR",
  DAY_TIME = "DAY",
}
export enum Calculations {
  Percentage = "percentage",
  ByteToKB = "byteToKB",
  ByteToMB = "byteToMB",
  ByteToGB = "byteToGB",
  Apdex = "apdex",
  ConvertSeconds = "convertSeconds",
  ConvertMilliseconds = "convertMilliseconds",
  MsToS = "msTos",
  Average = "average",
  PercentageAvg = "percentageAvg",
  ApdexAvg = "apdexAvg",
  SecondToDay = "secondToDay",
  NanosecondToMillisecond = "nanosecondToMillisecond",
}
export const NodeMetrics = `{
  "name": "service_cpm",
  "label": "Load",
  "unit": "cpm"
},
{
  "name": "service_sla",
  "calculation": "percentage",
  "label": "Success Rate",
  "unit": "%"
}`

export const EdgeMetrics = `{
  "name": "service_relation_server_resp_time",
  "label": "Client Latency",
  "unit": "ms",
  "type": "SERVER"
},{
  "name": "service_relation_client_cpm",
  "label": "Client Load",
  "unit": "cpm",
  "type": "CLINET"
}`
