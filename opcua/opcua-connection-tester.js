module.exports = function(RED) {
    function OpcUaConnectionTester(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const { OPCUAClient, MessageSecurityMode, SecurityPolicy } = require("node-opcua");

        node.on("input", async function(msg) {
            // Extract connection parameters from `msg.payload` or `config`
            const endpointUrl = msg.payload.endpoint || config.endpoint || "opc.tcp://localhost:4840";
            const securityPolicy = msg.payload.securityPolicy || config.securityPolicy || "None";
            const securityMode = msg.payload.securityMode || config.securityMode || "None";
            const username = msg.payload.username || config.username || null;
            const password = msg.payload.password || config.password || null;

            // Initialize OPC UA client with the specified parameters
            const client = OPCUAClient.create({
                endpointMustExist: false,
                securityPolicy: SecurityPolicy[securityPolicy],
                securityMode: MessageSecurityMode[securityMode]
            });

            // Update connection status
            node.status({ fill: "yellow", shape: "dot", text: "Connecting..." });

            try {
                // Step 1: Connect to the OPC UA server
                await client.connect(endpointUrl);
                node.status({ fill: "green", shape: "dot", text: "Connected" });

                // Step 2: Create a session (authenticated if credentials are provided)
                let session;
                if (username && password) {
                    session = await client.createSession({ userName: username, password: password });
                } else {
                    session = await client.createSession();
                }
                node.status({ fill: "green", shape: "ring", text: "Session created" });

                // Step 3: Read a test value (e.g., Server Status)
                const nodeToRead = { nodeId: "ns=0;i=2258", attributeId: 13 };
                const dataValue = await session.read(nodeToRead);

                // Step 4: Set a successful payload
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

                // Step 5: Close the session and disconnect
                await session.close();
                await client.disconnect();
                node.status({ fill: "blue", shape: "dot", text: "Disconnected" });
                
                node.send(msg);  // Send the success message

            } catch (error) {
                // Handle connection failure
                msg.payload = {
                    status: "failed",
                    endpoint: endpointUrl,
                    securityPolicy: securityPolicy,
                    securityMode: securityMode,
                    username: username ? "provided" : "anonymous",
                    error: error.message,
                    message: `Failed to connect or authenticate to ${endpointUrl}: ${error.message}`
                };
                node.error("OPC UA connection error: " + error.message, msg);
                node.status({ fill: "red", shape: "ring", text: "Connection failed" });
                
                node.send(msg);  // Send the failure message
            }
        });
    }
    RED.nodes.registerType("OpcUa-ConnectionTester", OpcUaConnectionTester);
};
