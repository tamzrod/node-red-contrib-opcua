// Import OPC UA library (only works outside Node-RED function node)
const { OPCUAClient, MessageSecurityMode, SecurityPolicy } = require("node-opcua");

// Extract connection parameters from msg.payload
const endpointUrl = msg.payload.endpoint || "opc.tcp://localhost:4840";  // Default to local OPC UA server
const securityPolicy = msg.payload.securityPolicy || "None";  // Set default security policy
const securityMode = msg.payload.securityMode || "None";  // Set default security mode
const username = msg.payload.username || null;
const password = msg.payload.password || null;

// Initialize OPC UA client with provided parameters
const client = OPCUAClient.create({
    endpointMustExist: false,
    securityPolicy: SecurityPolicy[securityPolicy],
    securityMode: MessageSecurityMode[securityMode]
});

// Connection status message
node.status({ fill: "yellow", shape: "dot", text: "Connecting..." });

try {
    // Step 1: Connect to OPC UA server
    await client.connect(endpointUrl);
    node.status({ fill: "green", shape: "dot", text: "Connected" });

    // Step 2: Create session (anonymous or authenticated)
    let session;
    if (username && password) {
        session = await client.createSession({ userName: username, password: password });
    } else {
        session = await client.createSession();
    }
    node.status({ fill: "green", shape: "ring", text: "Session created" });

    // Step 3: Read a test value (e.g., Server Status) from the server
    const nodeToRead = {
        nodeId: "ns=0;i=2258", // This ID reads the server's current time for testing
        attributeId: 13  // Value attribute
    };
    const dataValue = await session.read(nodeToRead);
    
    // Step 4: Output success message with read data
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

} catch (error) {
    // Error handling and failure output
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
}

// Return the message payload with status and result
return msg;
