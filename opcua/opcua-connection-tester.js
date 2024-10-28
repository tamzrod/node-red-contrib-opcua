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
            const timeout = msg.payload.timeout || config.timeout || 2000; // Default timeout is 2000 ms
            const maxRetry = msg.payload.maxRetry || config.maxRetry || 3; // Default max retry is 3

            // Resolve security policy and mode, and check if they are valid
            const resolvedSecurityPolicy = SecurityPolicy[securityPolicy];
            const resolvedSecurityMode = MessageSecurityMode[securityMode];

            if (!resolvedSecurityPolicy || !resolvedSecurityMode) {
                msg.payload = {
                    status: "error",
                    error: "Invalid security policy or mode. Please check configuration."
                };
                node.status({ fill: "red", shape: "dot", text: "Invalid security settings" });
                node.send(msg);
                return;
            }

            // Initialize OPC UA client with the specified parameters, including connection settings
            const client = OPCUAClient.create({
                endpointMustExist: false,
                securityPolicy: resolvedSecurityPolicy,
                securityMode: resolvedSecurityMode,
                connectionStrategy: {
                    maxRetry: maxRetry,
                    initialDelay: 2000,
                    maxDelay: 5000,
                    randomisationFactor: 0,
                },
                timeout: timeout // Use the timeout setting from config or default to 2000 ms
            });

            node.status({ fill: "yellow", shape: "dot", text: "Connecting..." });
            let session;

            try {
                // Log and attempt to connect to the OPC UA server
                console.log("Attempting to connect to OPC UA server:", endpointUrl);
                await client.connect(endpointUrl);
                console.log("Connected to OPC UA server");
                node.status({ fill: "green", shape: "dot", text: "Connected" });

                // Create a session based on security settings
                if (securityPolicy === "None" && securityMode === "None") {
                    console.log("Creating anonymous session...");
                    session = await client.createSession();
                } else if (username && password) {
                    console.log("Creating session with username and password...");
                    session = await client.createSession({ userName: username, password: password });
                } else {
                    throw new Error("Security is enabled but username/password is missing");
                }

                node.status({ fill: "green", shape: "ring", text: "Session created" });
                console.log("Session created");

                // Test reading a server attribute (e.g., Server Status)
                node.status({ fill: "blue", shape: "ring", text: "Reading server status..." });
                const nodeToRead = { nodeId: "ns=0;i=2258", attributeId: 13 };
                const dataValue = await session.read(nodeToRead);
                console.log("Read server status:", dataValue.value.value);

                // Set a successful payload
                msg.payload = {
                    status: "connected",
                    endpoint: endpointUrl,
                    securityPolicy: securityPolicy,
                    securityMode: securityMode,
                    serverStatus: dataValue.value.value // Assuming the value attribute contains the server status
                };
                node.send(msg);
            } catch (err) {
                // Log error details and update Node-RED status
                console.error("Error:", err.message);
                console.error(err.stack);
                msg.payload = {
                    status: "error",
                    error: err.message
                };
                node.status({ fill: "red", shape: "dot", text: "Error" });
                node.send(msg);
            } finally {
                // Ensure resources are released
                if (session) {
                    await session.close();
                    console.log("Session closed");
                }
                await client.disconnect();
                node.status({ fill: "blue", shape: "dot", text: "Disconnected" });
                console.log("Disconnected from OPC UA server");
            }
        });
    }

    RED.nodes.registerType("OpcUa-ConnectionTester", OpcUaConnectionTester, {
        settings: {
            timeout: { value: 2000, exportable: true }, // Default timeout of 2000 ms
            maxRetry: { value: 3, exportable: true } // Default max retry of 3
        }
    });
};
