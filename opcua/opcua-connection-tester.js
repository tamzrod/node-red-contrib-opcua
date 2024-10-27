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
            const timeout = msg.payload.timeout || config.timeout || 5000; // Default timeout of 5000 ms (5 seconds)

            // Initialize OPC UA client with the specified parameters
            const client = OPCUAClient.create({
                endpointMustExist: false,
                securityPolicy: SecurityPolicy[securityPolicy],
                securityMode: MessageSecurityMode[securityMode]
            });

            node.status({ fill: "yellow", shape: "dot", text: "Connecting..." });

            // Helper function to add timeout to the connection
            const connectWithTimeout = (client, endpointUrl, timeout) => {
                return Promise.race([
                    client.connect(endpointUrl),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Connection timed out")), timeout)
                    )
                ]);
            };

            try {
                // Connect to the OPC UA server with timeout
                await connectWithTimeout(client, endpointUrl, timeout);
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
                    serverStatus: dataValue.value.value // Assuming the value attribute contains the server status
                };
                node.send(msg);

                // Close the session and disconnect the client after testing
                await session.close();
                await client.disconnect();
                node.status({ fill: "blue", shape: "dot", text: "Disconnected" });
            } catch (err) {
                // Set error status and send error message
                node.status({ fill: "red", shape: "dot", text: "Error" });
                msg.payload = {
                    status: "error",
                    error: err.message
                };
                node.send(msg);
            }
        });
    }

    RED.nodes.registerType("opcua-connection-tester", OpcUaConnectionTester);
};
