export const Fragments = {
  serviceTopolgy: "query queryData($serviceId: ID!, $duration: Duration!) {\n  topology: getServiceTopology(serviceId: $serviceId, duration: $duration) {\n    nodes {\n      id\n      name\n      type\n      isReal\n    }\n    calls {\n      id\n      source\n      detectPoints\n      target\n    }\n  }}",
  globalTopology: "query queryData($duration: Duration!) {\n  topology: getGlobalTopology(duration: $duration) {\n    nodes {\n      id\n      name\n      type\n      isReal\n    }\n    calls {\n      id\n      source\n      detectPoints\n      target\n    }\n  }}",
  services: "query queryServices($duration: Duration!,$keyword: String!) {\n    services: getAllServices(duration: $duration, group: $keyword) {\n      id\n      name\n      group\n    }\n  }",
};

// proxy route
export const RoutePath = '/graphql';

export enum TimeType {
  MINUTE_TIME = "MINUTE",
  HOUR_TIME = "HOUR",
  DAY_TIME = "DAY",
}
