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
            let session;

            try {
                // Log and attempt to connect to the OPC UA server
                console.log("Attempting to connect to OPC UA server:", endpointUrl);
                await client.connect(endpointUrl);
                console.log("Connected to OPC UA server");
                node.status({ fill: "green", shape: "dot", text: "Connected" });

                // Create a session
                if (securityMode === "None" && securityPolicy === "None") {
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
                node.status({ fill: "red", shape: "dot", text: "Error" });
                msg.payload = {
                    status: "error",
                    error: err.message
                };
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

    RED.nodes.registerType("opcua-connection-tester", OpcUaConnectionTester);
};
