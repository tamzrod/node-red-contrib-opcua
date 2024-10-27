module.exports = function(RED) {
    function OpcUaConnectionTester(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const { OPCUAClient, MessageSecurityMode, SecurityPolicy } = require("node-opcua");

        node.on("input", async function(msg) {
            // Extract parameters from msg.payload with defaults from config or fallback values
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

            node.status({ fill: "yellow", shape: "dot", text: "Connecting..." });

            try {
                // Connect to the OPC UA server
                await client.connect(endpointUrl);
                node.status({ fill: "green", shape: "dot", text: "Connected" });

                // Create a session
                let session;
                if (securityMode === "None" && securityPolicy === "None") {
                    // Use anonymous session if securityMode and securityPolicy are None
                    session = await client.createSession();
                } else if (username && password) {
                    // Use username/password session if provided
                    session = await client.createSession({ userName: username, password: password });
                } else {
                    // Handle error for missing credentials when security is enabled
                    throw new Error("Security is enabled but username/password is missing");
                }

                node.status({ fill: "green", shape: "ring", text: "Session created" });

                // Test reading a server attribute (e.g., Server Status)
                const nodeToRead = { nodeId: "ns=0;i=2258", attributeId: 13 };
                const dataValue = await session.read(nodeToRead);

                // Set a successful payload
                msg.payload = {
                    status: "connected",
                    endpoint: endpointUrl,
                    securityPolicy: securityPolicy,
                    securityMode: securityMode,
                    username: securityMode === "None" && securityPolicy === "None" ? "anonymous" : (username ? "provided" : "none"),
                    readValue: dataValue.value.value,
                    message: `Connection to ${endpointUrl} was successful.`
                };

                node.status({ fill: "green", shape: "dot", text: "Read successful" });

                // Close session and disconnect
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
                    username: securityMode === "None" && securityPolicy === "None" ? "anonymous" : (username ? "provided" : "none"),
                    error: error.message,
                    message: `Failed to connect to ${endpointUrl}: ${error.message}`
                };
                node.error("OPC UA connection error: " + error.message, msg);
                node.status({ fill: "red", shape: "ring", text: "Connection failed" });

                node.send(msg);  // Send the failure message
            }
        });
    }

    RED.nodes.registerType("OpcUa-ConnectionTester", OpcUaConnectionTester);
};
