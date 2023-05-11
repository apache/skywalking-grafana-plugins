# Skywalking Grafana Plugins

SkyWalking Grafana Plugins provides a support for [Apache SkyWalking](https://skywalking.apache.org/). Add it to Grafana as a data source, then you are ready to build dashboards with SkyWalking to look at Topology. This topic explains configuration and queries specific to the SkyWalking data source.

## Install the latest version of SkyWalking data source in your Grafana application

   ```bash
   grafana-cli plugins install skywalking-skywalking-datasource
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

## Node Graph

1. Select the Dashboards tab.

2. Select the Node Graph in the dashboard.

5. Set the data source’s basic configuration options on the query tab:

|Name|Example(Value)|Description|
|----|----|----|
|Layer|$layer|Current layer of services|
|Service|$service|Current service|
|Node Metrics|`[{"name": "service_sla","calculation": "percentage""label": "Success Rate","unit": "%"}]`|Supports multiple metrics|
|Edge Metrics|`[{"name": "service_relation_server_cpm","label": "Client Load", "unit": "cpm","type": "SERVER" // "SERVER" || "CLINET"}]`|Only supports no more than two metrics|

## Getting started

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
