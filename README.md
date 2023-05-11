# Skywalking Grafana Plugins

<img src="http://skywalking.apache.org/assets/logo.svg" alt="Sky Walking logo" height="90px" align="right" />

SkyWalking Grafana Plugins provide extentions for [Apache SkyWalking](https://skywalking.apache.org/) visualizting telemetry data on Grafana. 

Currently, SkyWalking supports [PromQL](https://skywalking.apache.org/docs/main/next/en/api/promql-service/) to establish [Grafana metrics dashboard](https://skywalking.apache.org/docs/main/next/en/setup/backend/ui-grafana/). 

The plugins are focusing on visualizing more telemetry data, e.g. Service Map Topology, as a new Grafana data source implementation.

## Install the latest version of SkyWalking data source in your Grafana application

* Require Grafana 9.5.1+

```bash
> grafana-cli plugins install skywalking-datasource
```

## Configure the data source

To configure basic settings for the data source, complete the following steps:

1. Click Connections in the left-side menu.

2. Under Your connections, click Data sources.

3. Enter SkyWalking in the search bar.

4. Select SkyWalking.

The Settings tab of the data source is displayed.

5. Set the data source’s basic configuration options:

|Name|Description|
|----|----|
|Name|Sets the name you use to refer to the data source in panels and queries.|
|URL|Sets the URL of the SkyWalking instance, such as http://skywalking.example.com/graphql.|

## Add Service Topology Graph

1. Select the Dashboards tab.

2. Select the Node Graph in the dashboard.

5. Set the data source’s basic configuration options on the query tab:

|Name|Example(Value)|Description|
|----|----|----|
|Layer|[$layer](https://skywalking.apache.org/docs/main/next/en/setup/backend/ui-grafana/#dashboards-settings)|Current layer of services|
|Service|[$service](https://skywalking.apache.org/docs/main/next/en/setup/backend/ui-grafana/#dashboards-settings)|Current service|
|Node Metrics|`[{"name":"service_sla","calculation":"percentage","label":"Success Rate","unit":"%"}]`|Supports multiple metrics|
|Edge Metrics|`[{"name":"service_relation_server_cpm","label":"Client Load","unit":"cpm","type":"SERVER"}]`|Only supports maximum two metrics|

# Contact Us
* Mail list: **dev@skywalking.apache.org**. Mail to `dev-subscribe@skywalking.apache.org`, follow the reply to subscribe the mail list.
* Send `Request to join SkyWalking slack` mail to the mail list(`dev@skywalking.apache.org`), we will invite you in.
* Twitter, [ASFSkyWalking](https://twitter.com/AsfSkyWalking)
* QQ Group: 901167865, 392443393
* [bilibili B站 视频](https://space.bilibili.com/390683219)

# License
[Apache 2.0 License.](LICENSE)

____
## Build the plugin from the source codes and run locally

1. Install dependencies

   ```bash
   yarn install
   ```

2. Build plugin in development mode and run in watch mode

   ```bash
   yarn dev
   ```

3. Build plugin in production mode

   ```bash
   yarn build
   ```

4. Run the tests (using Jest)

   ```bash
   # Runs the tests and watches for changes, requires git init first
   yarn test
   
   # Exits after running all the tests
   yarn test:ci
   ```

5. Spin up a Grafana instance and run the plugin inside it (using Docker)

   ```bash
   yarn server
   ```

6. Run the E2E tests (using Cypress)

   ```bash
   # Spins up a Grafana instance first that we tests against 
   yarn server
   
   # Starts the tests
   yarn e2e
   ```

7. Run the linter

   ```bash
   yarn lint
   
   # or

   yarn lint:fix
   ```
