/**

 Copyright 2024 Your Company

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 **/

 module.exports = function (RED) {
    "use strict";
    const { OPCUAClient, MessageSecurityMode, SecurityPolicy } = require("node-opcua");

    function OpcUaConnectionTester(config) {
        RED.nodes.createNode(this, config);

        const node = this;
        node.endpoint = config.endpoint || "opc.tcp://localhost:4840";
        node.securityPolicy = config.securityPolicy || "None";
        node.securityMode = config.securityMode || "None";
        node.username = config.username || null;
        node.password = config.password || null;

        // Helper functions for logging
        function verboseWarn(message) {
            node.warn((node.name ? node.name + ': ' : '') + message);
        }

        function verboseLog(message) {
            node.debug(message);
        }

        node.on("input", async function (msg) {
            const endpointUrl = msg.payload.endpoint || node.endpoint;
            const securityPolicy = msg.payload.securityPolicy || node.securityPolicy;
            const securityMode = msg.payload.securityMode || node.securityMode;
            const username = msg.payload.username || node.username;
            const password = msg.payload.password || node.password;

            verboseLog(`Connecting to ${endpointUrl} with policy ${securityPolicy} and mode ${securityMode}`);

            // Initialize OPC UA client
            const client = OPCUAClient.create({
                endpointMustExist: false,
                securityPolicy: SecurityPolicy[securityPolicy],
                securityMode: MessageSecurityMode[securityMode]
            });

            node.status({ fill: "yellow", shape: "dot", text: "Connecting..." });

            try {
                // Step 1: Connect to the OPC UA server
                await client.connect(endpointUrl);
                node.status({ fill: "green", shape: "dot", text: "Connected" });
                verboseLog(`Connected to ${endpointUrl}`);

                // Step 2: Create a session
                let session;
                if (username && password) {
                    session = await client.createSession({ userName: username, password: password });
                } else {
                    session = await client.createSession();
                }
                node.status({ fill: "green", shape: "ring", text: "Session created" });
                verboseLog("Session created successfully");

                // Step 3: Read a test value
                const nodeToRead = { nodeId: "ns=0;i=2258", attributeId: 13 };
                const dataValue = await session.read(nodeToRead);
                verboseLog("Read test value: " + JSON.stringify(dataValue.value.value));

                // Update payload with successful connection details
                msg.payload = {
                    status: "connected",
                    endpoint: endpointUrl,
                    securityPolicy: securityPolicy,
                    securityMode: securityMode,
                    username: username ? "provided" : "anonymous",
                    readValue: dataValue.value.value,
                    message: `Connection to ${endpointUrl} was successful.`
                };
                node.status({ fill: "green", shape: "dot", text: "Read successful" });

                // Step 5: Close session and disconnect
                await session.close();
                await client.disconnect();
                node.status({ fill: "blue", shape: "dot", text: "Disconnected" });
                verboseLog("Disconnected successfully");

                node.send(msg);  // Send success message

            } catch (error) {
                // Handle connection errors
                msg.payload = {
                    status: "failed",
                    endpoint: endpointUrl,
                    securityPolicy: securityPolicy,
                    securityMode: securityMode,
                    username: username ? "provided" : "anonymous",
                    error: error.message,
                    message: `Failed to connect or authenticate to ${endpointUrl}: ${error.message}`
                };
                verboseWarn("OPC UA connection error: " + error.message);
                node.status({ fill: "red", shape: "ring", text: "Connection failed" });
                
                node.send(msg);  // Send failure message
            }
        });
    }

    RED.nodes.registerType("OpcUa-ConnectionTester", OpcUaConnectionTester);
};
