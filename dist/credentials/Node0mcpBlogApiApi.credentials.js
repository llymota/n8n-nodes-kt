"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Node0mcpBlogApiApi = void 0;
class Node0mcpBlogApiApi {
    constructor() {
        this.name = "node0mcpBlogApiApi";
        this.displayName = "0mcp Blog API";
        this.documentationUrl = "https://0mcp.dev";
        this.icon = {
            light: "file:../nodes/Node0mcpBlogApi/node0mcpBlogApi.svg",
            dark: "file:../nodes/Node0mcpBlogApi/node0mcpBlogApi.dark.svg"
        };
        this.properties = [
            {
                displayName: "X-API-Key",
                name: "secret",
                type: "string",
                typeOptions: {
                    password: true
                },
                default: "",
                required: true
            }
        ];
        this.authenticate = {
            type: "generic",
            properties: {
                headers: {
                    "X-API-Key": "={{$credentials.secret}}"
                }
            }
        };
        this.test = {
            request: {
                baseURL: "https://0mcp.dev",
                url: "/api/blogs"
            }
        };
    }
}
exports.Node0mcpBlogApiApi = Node0mcpBlogApiApi;
//# sourceMappingURL=Node0mcpBlogApiApi.credentials.js.map