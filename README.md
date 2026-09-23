# 0mcp Blog API n8n community node

sdfsdfsdfsdf

Generated from OpenAPI 1.0.0 with template 1.1.0. Generated files are platform-managed and will be overwritten during regeneration.

## Authentication

Configure the generated API key credential in n8n before using the node.

## Supported operations

- `DELETE /api/blogs/{id}` - Soft delete a blog post
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/blogs` - List blog posts
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/blogs/{id}` - Get a blog post
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /api/blogs/{id}` - Update a blog post without changing publish state
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/blogs` - Create a blog draft
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/blogs/{id}/publish` - Publish a blog post
  - Retry Contract: none
  - Pagination Contract: none

## Usage

1. Install this community-node package in n8n.
2. Add the **0mcp Blog API** node to a workflow.
3. Select a resource and operation, configure its parameters, and execute the workflow.

## Example workflow

Connect **Manual Trigger** -> **0mcp Blog API** -> a destination node, select an operation, then run the workflow and inspect the returned items.

## Development

```sh
npm install
npm run build
npm run lint
npm run dev
```

`npm run dev` starts a local n8n development instance. Find the integration by its **0mcp Blog API** display name.
