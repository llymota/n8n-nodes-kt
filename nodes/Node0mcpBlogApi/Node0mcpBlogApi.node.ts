import { NodeConnectionTypes, NodeApiError, NodeOperationError, type IDataObject, type IExecuteFunctions, type IHttpRequestOptions, type INodeExecutionData, type INodeType, type INodeTypeDescription, type JsonObject } from "n8n-workflow";
import { requestWithRetry } from "../../shared/http";

// Generated with ts-morph
type CredentialApplication = { credentialType: string; type: 'apiKey' | 'basic' | 'bearer' | 'oauth2' | 'custom'; location?: 'header' | 'query'; parameter?: string; injections?: Array<{ target: 'header' | 'query' | 'body'; name: string; value: string }> };
type RetryContract = { mode: string; retryConnectionFailures?: boolean; retryTimeouts?: boolean; retryRateLimits?: boolean; retryServerErrors?: boolean; maxAttempts: number; maxElapsedMs: number; baseBackoffMs: number; maxBackoffMs: number; jitterRatio: number; idempotency?: { target: 'header' | 'query' | 'body'; parameter: string } };
type PaginationContract = { style: string; page?: string; limit?: string; cursor?: string; responseCursor?: string; hasMore?: string; itemPath?: string; advancement?: string; maxPages: number; maxItems: number; maxElapsedMs: number; maxMemoryBytes: number; repeatedCursorLimit: number; repeatedPageLimit: number; pageSize: number };

function normalizeParameterValue(value: unknown): IDataObject[string] {
  if (value && typeof value === 'object' && 'value' in value) return (value as { value: IDataObject[string] }).value;
  return value as IDataObject[string];
}


type BodyFieldContract = {
  name: string;
  displayName?: string;
  description?: string;
  type?: string;
  format?: string;
  required?: boolean;
  minValue?: number;
  maxValue?: number;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  pattern?: string;
  fields?: BodyFieldContract[];
  items?: BodyFieldContract;
  additionalValue?: BodyFieldContract;
  alternatives?: BodyFieldContract[];
  composition?: 'oneOf' | 'anyOf';
  representation?: string;
  nullable?: boolean;
};

function normalizeJsonValue(value: unknown, label: string, context: IExecuteFunctions, itemIndex: number): IDataObject | IDataObject[] | string | number | boolean | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed) as IDataObject | IDataObject[] | string | number | boolean | null;
    } catch (error) {
      throw new NodeOperationError(context.getNode(), `${label} must be valid JSON: ${(error as Error).message}`, { itemIndex });
    }
  }
  if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value as IDataObject | IDataObject[] | string | number | boolean | null;
  throw new NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}


function validateBodyValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): void {
  if (value === undefined || value === '') {
    if (contract.required) throw new NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
    return;
  }
  if (value === null) {
    if (contract.nullable) return;
    throw new NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
  }
  if (contract.alternatives?.length) {
    selectAlternativeValue(value, contract, path, context, itemIndex);
    return;
  }
  if (contract.type === 'string' && typeof value !== 'string') throw new NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
  if (contract.type === 'boolean' && typeof value !== 'boolean') throw new NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
  if (contract.type === 'number' && typeof value !== 'number') throw new NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
  if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) throw new NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
  if (contract.enum?.length) {
    const enumValueMatches = (candidate: unknown): boolean => candidate === value ||
      (candidate === null && value === 'null') ||
      (candidate === 'null' && value === null) ||
      Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
    const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
    const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
      ? value.every((item) => contract.enum!.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
      : contract.enum.some(enumValueMatches);
    if (!matches) throw new NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
  }
  if (contract.type === 'number' || contract.type === 'integer') {
    const numeric = value as number;
    if (contract.minValue !== undefined && numeric < contract.minValue) throw new NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
    if (contract.maxValue !== undefined && numeric > contract.maxValue) throw new NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
  }
  if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value)) throw new NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
  if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
  if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
    try {
      new URL(value);
    } catch {
      throw new NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
    }
  }
  if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
  if (contract.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
    const objectValue = value as IDataObject;
    for (const child of contract.fields ?? []) validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
    if (contract.additionalValue) {
      const known = new Set((contract.fields ?? []).map((field) => field.name));
      for (const [key, childValue] of Object.entries(objectValue)) {
        if (!known.has(key)) {
          if (contract.additionalValue.alternatives?.length && contract.additionalValue.representation === 'raw') continue;
          validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
        }
      }
    }
  }
  if (contract.type === 'array') {
    if (!Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
    if (contract.items) value.forEach((item, index) => validateBodyValue(item, contract.items!, `${path}[${index}]`, context, itemIndex));
  }
}

function setBodyField(body: IDataObject, contract: BodyFieldContract, value: unknown, context: IExecuteFunctions, itemIndex: number): void {
  const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
    ? normalizeJsonValue(value, contract.displayName ?? contract.name, context, itemIndex)
    : normalizeParameterValue(value);
  const selected = contract.alternatives?.length ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
  validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
  body[contract.name] = selected as IDataObject[string];
}


function selectAlternativeValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
  const selectedName = String((value as IDataObject).schemaAlternative ?? '');
  const selected = (contract.alternatives ?? []).find((alternative) => alternative.name === selectedName);
  if (!selected) throw new NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${(contract.alternatives ?? []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
  const selectedValue = (value as IDataObject).value;
  validateBodyValue(selectedValue, selected, path, context, itemIndex);
  return selectedValue;
}




function selectResponseFields(value: IDataObject, fields: string[]): IDataObject {
  if (fields.length === 0) return value;
  const selected: IDataObject = {};
  if (value.id !== undefined) selected.id = value.id;
  for (const field of fields) if (value[field] !== undefined) selected[field] = value[field];
  return selected;
}

function valueAtPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split('.').filter(Boolean).reduce((current: unknown, segment) => {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) return current[Number(segment)];
    return (current as IDataObject)[segment];
  }, value);
}

export class Node0mcpBlogApi implements INodeType {
  description: INodeTypeDescription = {
        displayName: "0mcp Blog API",
        name: "node0mcpBlogApi",
        icon: {
            light: "file:node0mcpBlogApi.svg",
            dark: "file:node0mcpBlogApi.dark.svg"
        },
        group: [],
        version: [
            1
        ],
        subtitle: "={{$parameter[\"operation\"] + \": \" + $parameter[\"resource\"]}}",
        description: "sdfsdfsdfsdf",
        hints: [
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            }
        ],
        defaults: {
            name: "0mcp Blog API"
        },
        usableAsTool: true,
        inputs: [
            NodeConnectionTypes.Main
        ],
        outputs: [
            NodeConnectionTypes.Main
        ],
        credentials: [
            {
                name: "node0mcpBlogApiApi",
                required: true
            }
        ],
        properties: [
            {
                displayName: "Resource",
                name: "resource",
                type: "options",
                noDataExpression: true,
                default: "blogs",
                options: [
                    {
                        name: "Blog",
                        value: "blogs"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ]
                    }
                },
                default: "deleteApiBlogsId",
                options: [
                    {
                        name: "Create A Blog Draft",
                        value: "postApiBlogs",
                        action: "Create blog draft",
                        description: "Create blog draft"
                    },
                    {
                        name: "Get A Blog Post",
                        value: "getApiBlogsId",
                        action: "Get blog post",
                        description: "Get blog post"
                    },
                    {
                        name: "List Blog Posts",
                        value: "getApiBlogs",
                        action: "List blog posts"
                    },
                    {
                        name: "Publish A Blog Post",
                        value: "postApiBlogsIdPublish",
                        action: "Publish blog post",
                        description: "Publish blog post"
                    },
                    {
                        name: "Soft Delete A Blog Post",
                        value: "deleteApiBlogsId",
                        action: "Soft delete a blog post"
                    },
                    {
                        name: "Update A Blog Post Without Changing Publish State",
                        value: "patchApiBlogsId",
                        action: "Update blog post without changing publish state",
                        description: "Update blog post without changing publish state"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "deleteApiBlogsId"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "getApiBlogs"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Category",
                        name: "category",
                        type: "options",
                        default: "Engineering",
                        description: "Filter posts by category",
                        options: [
                            {
                                name: "Announcements",
                                value: "Announcements"
                            },
                            {
                                name: "Engineering",
                                value: "Engineering"
                            },
                            {
                                name: "Guides",
                                value: "Guides"
                            },
                            {
                                name: "News",
                                value: "News"
                            },
                            {
                                name: "Product",
                                value: "Product"
                            }
                        ]
                    },
                    {
                        displayName: "Page",
                        name: "page",
                        type: "number",
                        default: 1,
                        description: "One-based page number",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Page Size",
                        name: "page_size",
                        type: "number",
                        default: 12,
                        description: "Number of posts per page",
                        typeOptions: {
                            minValue: 1,
                            maxValue: 50
                        }
                    },
                    {
                        displayName: "Status",
                        name: "status",
                        type: "options",
                        default: "all",
                        description: "Filter posts by publish status",
                        options: [
                            {
                                name: "All",
                                value: "all"
                            },
                            {
                                name: "Draft",
                                value: "draft"
                            },
                            {
                                name: "Published",
                                value: "published"
                            }
                        ]
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "getApiBlogsId"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "patchApiBlogsId"
                        ]
                    }
                }
            },
            {
                displayName: "Category",
                name: "category",
                type: "options",
                default: "Engineering",
                required: true,
                options: [
                    {
                        name: "Announcements",
                        value: "Announcements"
                    },
                    {
                        name: "Engineering",
                        value: "Engineering"
                    },
                    {
                        name: "Guides",
                        value: "Guides"
                    },
                    {
                        name: "News",
                        value: "News"
                    },
                    {
                        name: "Product",
                        value: "Product"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "patchApiBlogsId"
                        ]
                    }
                }
            },
            {
                displayName: "Content",
                name: "content",
                type: "string",
                default: "",
                required: true,
                description: "HTML",
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "patchApiBlogsId"
                        ]
                    }
                }
            },
            {
                displayName: "Description",
                name: "description",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "patchApiBlogsId"
                        ]
                    }
                }
            },
            {
                displayName: "Faq Content",
                name: "faq_content",
                type: "json",
                default: [],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "patchApiBlogsId"
                        ]
                    }
                }
            },
            {
                displayName: "Schema Type",
                name: "schema_type",
                type: "options",
                default: "BlogPosting",
                required: true,
                options: [
                    {
                        name: "Article",
                        value: "Article"
                    },
                    {
                        name: "BlogPosting",
                        value: "BlogPosting"
                    },
                    {
                        name: "TechArticle",
                        value: "TechArticle"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "patchApiBlogsId"
                        ]
                    }
                }
            },
            {
                displayName: "Seo Keywords",
                name: "seo_keywords",
                type: "json",
                default: [],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "patchApiBlogsId"
                        ]
                    }
                }
            },
            {
                displayName: "Slug",
                name: "slug",
                type: "string",
                default: "",
                required: true,
                hint: "Expected format: ^[a-z0-9]+(?:-[a-z0-9]+)*$",
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "patchApiBlogsId"
                        ]
                    }
                }
            },
            {
                displayName: "Title",
                name: "title",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "patchApiBlogsId"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "patchApiBlogsId"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Authors",
                        name: "authors",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Canonical URL",
                        name: "canonical_url",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Created At",
                        name: "created_at",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Featured Image",
                        name: "featured_image",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Featured Image Alt",
                        name: "featured_image_alt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Focus Keyword",
                        name: "focus_keyword",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "ID (Body)",
                        name: "idBody",
                        type: "string",
                        default: "",
                        hint: "Expected format: uuid"
                    },
                    {
                        displayName: "Is Published",
                        name: "is_published",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable is published"
                    },
                    {
                        displayName: "Meta Description",
                        name: "meta_description",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Meta Title",
                        name: "meta_title",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Og Description",
                        name: "og_description",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Og Image",
                        name: "og_image",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Og Image Alt",
                        name: "og_image_alt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Og Title",
                        name: "og_title",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Published At",
                        name: "published_at",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Reading Time",
                        name: "reading_time",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Robots Follow",
                        name: "robots_follow",
                        type: "boolean",
                        default: true,
                        description: "Whether to enable robots follow"
                    },
                    {
                        displayName: "Robots Index",
                        name: "robots_index",
                        type: "boolean",
                        default: true,
                        description: "Whether to enable robots index"
                    },
                    {
                        displayName: "Tldr",
                        name: "tldr",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Twitter Description",
                        name: "twitter_description",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Twitter Image",
                        name: "twitter_image",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Twitter Image Alt",
                        name: "twitter_image_alt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Twitter Title",
                        name: "twitter_title",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Updated At",
                        name: "updated_at",
                        type: "dateTime",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Category",
                name: "category",
                type: "options",
                default: "Engineering",
                required: true,
                options: [
                    {
                        name: "Announcements",
                        value: "Announcements"
                    },
                    {
                        name: "Engineering",
                        value: "Engineering"
                    },
                    {
                        name: "Guides",
                        value: "Guides"
                    },
                    {
                        name: "News",
                        value: "News"
                    },
                    {
                        name: "Product",
                        value: "Product"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "postApiBlogs"
                        ]
                    }
                }
            },
            {
                displayName: "Content",
                name: "content",
                type: "string",
                default: "",
                required: true,
                description: "HTML",
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "postApiBlogs"
                        ]
                    }
                }
            },
            {
                displayName: "Description",
                name: "description",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "postApiBlogs"
                        ]
                    }
                }
            },
            {
                displayName: "Faq Content",
                name: "faq_content",
                type: "json",
                default: [],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "postApiBlogs"
                        ]
                    }
                }
            },
            {
                displayName: "Schema Type",
                name: "schema_type",
                type: "options",
                default: "BlogPosting",
                required: true,
                options: [
                    {
                        name: "Article",
                        value: "Article"
                    },
                    {
                        name: "BlogPosting",
                        value: "BlogPosting"
                    },
                    {
                        name: "TechArticle",
                        value: "TechArticle"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "postApiBlogs"
                        ]
                    }
                }
            },
            {
                displayName: "Seo Keywords",
                name: "seo_keywords",
                type: "json",
                default: [],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "postApiBlogs"
                        ]
                    }
                }
            },
            {
                displayName: "Slug",
                name: "slug",
                type: "string",
                default: "",
                required: true,
                hint: "Expected format: ^[a-z0-9]+(?:-[a-z0-9]+)*$",
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "postApiBlogs"
                        ]
                    }
                }
            },
            {
                displayName: "Title",
                name: "title",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "postApiBlogs"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "postApiBlogs"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Authors",
                        name: "authors",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Canonical URL",
                        name: "canonical_url",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Created At",
                        name: "created_at",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Featured Image",
                        name: "featured_image",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Featured Image Alt",
                        name: "featured_image_alt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Focus Keyword",
                        name: "focus_keyword",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "ID",
                        name: "id",
                        type: "string",
                        default: "",
                        hint: "Expected format: uuid"
                    },
                    {
                        displayName: "Is Published",
                        name: "is_published",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable is published"
                    },
                    {
                        displayName: "Meta Description",
                        name: "meta_description",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Meta Title",
                        name: "meta_title",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Og Description",
                        name: "og_description",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Og Image",
                        name: "og_image",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Og Image Alt",
                        name: "og_image_alt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Og Title",
                        name: "og_title",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Published At",
                        name: "published_at",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Reading Time",
                        name: "reading_time",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Robots Follow",
                        name: "robots_follow",
                        type: "boolean",
                        default: true,
                        description: "Whether to enable robots follow"
                    },
                    {
                        displayName: "Robots Index",
                        name: "robots_index",
                        type: "boolean",
                        default: true,
                        description: "Whether to enable robots index"
                    },
                    {
                        displayName: "Tldr",
                        name: "tldr",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Twitter Description",
                        name: "twitter_description",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Twitter Image",
                        name: "twitter_image",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Twitter Image Alt",
                        name: "twitter_image_alt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Twitter Title",
                        name: "twitter_title",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Updated At",
                        name: "updated_at",
                        type: "dateTime",
                        default: ""
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "blogs"
                        ],
                        operation: [
                            "postApiBlogsIdPublish"
                        ]
                    }
                }
            }
        ]
    };

  public async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const inputItems = this.getInputData();
    const output: INodeExecutionData[] = [];
    for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
      const outputStart = output.length;
      let errorPlan: Record<string, { title: string; recovery?: string; parameter?: string }> = {};
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        const nodeVersion = this.getNode().typeVersion;
        let additionalFields: IDataObject = {};
        const nodeOptions = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
        
        let retryContract: RetryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
        let credentialApplications: CredentialApplication[] | undefined;
        let options: IHttpRequestOptions;
        let pagination: PaginationContract = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        let responsePlan: { binary: boolean; full: boolean; envelopePath: string; itemPath: string; fields: string[]; simplified: string[] } = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        switch (operation) {
          case "deleteApiBlogsId": {
        
        
        let path = "/api/blogs/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://0mcp.dev", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"node0mcpBlogApiApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"},"409":{"title":"Conflict"}};
        break;
      }
    case "getApiBlogs": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/api/blogs";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["status"] !== undefined) qs["status"] = additionalFields["status"];
    if (additionalFields["category"] !== undefined) qs["category"] = additionalFields["category"];
    if (additionalFields["page"] !== undefined) qs["page"] = additionalFields["page"];
    if (additionalFields["page_size"] !== undefined) qs["page_size"] = additionalFields["page_size"];
        
        
        const serverBaseUrl = { url: "https://0mcp.dev", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"node0mcpBlogApiApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["pagination","posts"], simplified: ["pagination","posts"] };
        errorPlan = {"400":{"title":"Invalid request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"},"409":{"title":"Conflict"}};
        break;
      }
    case "getApiBlogsId": {
        
        
        let path = "/api/blogs/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://0mcp.dev", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"node0mcpBlogApiApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"},"409":{"title":"Conflict"}};
        break;
      }
    case "patchApiBlogsId": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/api/blogs/{id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        if (additionalFields["authors"] !== undefined) setBodyField(body as IDataObject, {"name":"authors","displayName":"Authors","type":"array","items":{"name":"item","displayName":"Item","type":"object","fields":[{"name":"avatar","displayName":"Avatar","type":"string"},{"name":"bio","displayName":"Bio","type":"string"},{"name":"name","displayName":"Name","type":"string","required":true},{"name":"profile_url","displayName":"Profile url","type":"string"},{"name":"role","displayName":"Role","type":"string"}],"representation":"raw"},"representation":"raw"}, additionalFields["authors"], this, itemIndex);
    if (additionalFields["canonical_url"] !== undefined) setBodyField(body as IDataObject, {"name":"canonical_url","displayName":"Canonical url","type":"string","nullable":true}, additionalFields["canonical_url"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"category","displayName":"Category","type":"string","required":true,"enum":["Engineering","Announcements","News","Guides","Product"]}, this.getNodeParameter("category", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"content","displayName":"Content","type":"string","required":true,"description":"HTML"}, this.getNodeParameter("content", itemIndex), this, itemIndex);
    if (additionalFields["created_at"] !== undefined) setBodyField(body as IDataObject, {"name":"created_at","displayName":"Created at","type":"string","format":"date-time"}, additionalFields["created_at"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"description","displayName":"Description","type":"string","required":true}, this.getNodeParameter("description", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"faq_content","displayName":"Faq content","type":"array","required":true,"items":{"name":"item","displayName":"Item","type":"object","fields":[{"name":"answer","displayName":"Answer","type":"string","required":true},{"name":"question","displayName":"Question","type":"string","required":true}],"representation":"raw"},"representation":"raw"}, this.getNodeParameter("faq_content", itemIndex), this, itemIndex);
    if (additionalFields["featured_image"] !== undefined) setBodyField(body as IDataObject, {"name":"featured_image","displayName":"Featured image","type":"string","nullable":true}, additionalFields["featured_image"], this, itemIndex);
    if (additionalFields["featured_image_alt"] !== undefined) setBodyField(body as IDataObject, {"name":"featured_image_alt","displayName":"Featured image alt","type":"string","nullable":true}, additionalFields["featured_image_alt"], this, itemIndex);
    if (additionalFields["focus_keyword"] !== undefined) setBodyField(body as IDataObject, {"name":"focus_keyword","displayName":"Focus keyword","type":"string","nullable":true}, additionalFields["focus_keyword"], this, itemIndex);
    if (additionalFields["idBody"] !== undefined) setBodyField(body as IDataObject, {"name":"id","displayName":"Id","type":"string","format":"uuid"}, additionalFields["idBody"], this, itemIndex);
    if (additionalFields["is_published"] !== undefined) setBodyField(body as IDataObject, {"name":"is_published","displayName":"Is published","type":"boolean"}, additionalFields["is_published"], this, itemIndex);
    if (additionalFields["meta_description"] !== undefined) setBodyField(body as IDataObject, {"name":"meta_description","displayName":"Meta description","type":"string","nullable":true}, additionalFields["meta_description"], this, itemIndex);
    if (additionalFields["meta_title"] !== undefined) setBodyField(body as IDataObject, {"name":"meta_title","displayName":"Meta title","type":"string","nullable":true}, additionalFields["meta_title"], this, itemIndex);
    if (additionalFields["og_description"] !== undefined) setBodyField(body as IDataObject, {"name":"og_description","displayName":"Og description","type":"string","nullable":true}, additionalFields["og_description"], this, itemIndex);
    if (additionalFields["og_image"] !== undefined) setBodyField(body as IDataObject, {"name":"og_image","displayName":"Og image","type":"string","nullable":true}, additionalFields["og_image"], this, itemIndex);
    if (additionalFields["og_image_alt"] !== undefined) setBodyField(body as IDataObject, {"name":"og_image_alt","displayName":"Og image alt","type":"string","nullable":true}, additionalFields["og_image_alt"], this, itemIndex);
    if (additionalFields["og_title"] !== undefined) setBodyField(body as IDataObject, {"name":"og_title","displayName":"Og title","type":"string","nullable":true}, additionalFields["og_title"], this, itemIndex);
    if (additionalFields["published_at"] !== undefined) setBodyField(body as IDataObject, {"name":"published_at","displayName":"Published at","type":"string","format":"date-time","nullable":true}, additionalFields["published_at"], this, itemIndex);
    if (additionalFields["reading_time"] !== undefined) setBodyField(body as IDataObject, {"name":"reading_time","displayName":"Reading time","type":"string","nullable":true}, additionalFields["reading_time"], this, itemIndex);
    if (additionalFields["robots_follow"] !== undefined) setBodyField(body as IDataObject, {"name":"robots_follow","displayName":"Robots follow","type":"boolean","default":true}, additionalFields["robots_follow"], this, itemIndex);
    if (additionalFields["robots_index"] !== undefined) setBodyField(body as IDataObject, {"name":"robots_index","displayName":"Robots index","type":"boolean","default":true}, additionalFields["robots_index"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"schema_type","displayName":"Schema type","type":"string","required":true,"enum":["BlogPosting","Article","TechArticle"]}, this.getNodeParameter("schema_type", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"seo_keywords","displayName":"Seo keywords","type":"array","required":true,"items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"}, this.getNodeParameter("seo_keywords", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"slug","displayName":"Slug","type":"string","required":true,"pattern":"^[a-z0-9]+(?:-[a-z0-9]+)*$"}, this.getNodeParameter("slug", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"title","displayName":"Title","type":"string","required":true}, this.getNodeParameter("title", itemIndex), this, itemIndex);
    if (additionalFields["tldr"] !== undefined) setBodyField(body as IDataObject, {"name":"tldr","displayName":"Tldr","type":"string","nullable":true}, additionalFields["tldr"], this, itemIndex);
    if (additionalFields["twitter_description"] !== undefined) setBodyField(body as IDataObject, {"name":"twitter_description","displayName":"Twitter description","type":"string","nullable":true}, additionalFields["twitter_description"], this, itemIndex);
    if (additionalFields["twitter_image"] !== undefined) setBodyField(body as IDataObject, {"name":"twitter_image","displayName":"Twitter image","type":"string","nullable":true}, additionalFields["twitter_image"], this, itemIndex);
    if (additionalFields["twitter_image_alt"] !== undefined) setBodyField(body as IDataObject, {"name":"twitter_image_alt","displayName":"Twitter image alt","type":"string","nullable":true}, additionalFields["twitter_image_alt"], this, itemIndex);
    if (additionalFields["twitter_title"] !== undefined) setBodyField(body as IDataObject, {"name":"twitter_title","displayName":"Twitter title","type":"string","nullable":true}, additionalFields["twitter_title"], this, itemIndex);
    if (additionalFields["updated_at"] !== undefined) setBodyField(body as IDataObject, {"name":"updated_at","displayName":"Updated at","type":"string","format":"date-time"}, additionalFields["updated_at"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://0mcp.dev", blockRedirects: false };
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"node0mcpBlogApiApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"},"409":{"title":"Conflict"}};
        break;
      }
    case "postApiBlogs": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/api/blogs";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["authors"] !== undefined) setBodyField(body as IDataObject, {"name":"authors","displayName":"Authors","type":"array","items":{"name":"item","displayName":"Item","type":"object","fields":[{"name":"avatar","displayName":"Avatar","type":"string"},{"name":"bio","displayName":"Bio","type":"string"},{"name":"name","displayName":"Name","type":"string","required":true},{"name":"profile_url","displayName":"Profile url","type":"string"},{"name":"role","displayName":"Role","type":"string"}],"representation":"raw"},"representation":"raw"}, additionalFields["authors"], this, itemIndex);
    if (additionalFields["canonical_url"] !== undefined) setBodyField(body as IDataObject, {"name":"canonical_url","displayName":"Canonical url","type":"string","nullable":true}, additionalFields["canonical_url"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"category","displayName":"Category","type":"string","required":true,"enum":["Engineering","Announcements","News","Guides","Product"]}, this.getNodeParameter("category", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"content","displayName":"Content","type":"string","required":true,"description":"HTML"}, this.getNodeParameter("content", itemIndex), this, itemIndex);
    if (additionalFields["created_at"] !== undefined) setBodyField(body as IDataObject, {"name":"created_at","displayName":"Created at","type":"string","format":"date-time"}, additionalFields["created_at"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"description","displayName":"Description","type":"string","required":true}, this.getNodeParameter("description", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"faq_content","displayName":"Faq content","type":"array","required":true,"items":{"name":"item","displayName":"Item","type":"object","fields":[{"name":"answer","displayName":"Answer","type":"string","required":true},{"name":"question","displayName":"Question","type":"string","required":true}],"representation":"raw"},"representation":"raw"}, this.getNodeParameter("faq_content", itemIndex), this, itemIndex);
    if (additionalFields["featured_image"] !== undefined) setBodyField(body as IDataObject, {"name":"featured_image","displayName":"Featured image","type":"string","nullable":true}, additionalFields["featured_image"], this, itemIndex);
    if (additionalFields["featured_image_alt"] !== undefined) setBodyField(body as IDataObject, {"name":"featured_image_alt","displayName":"Featured image alt","type":"string","nullable":true}, additionalFields["featured_image_alt"], this, itemIndex);
    if (additionalFields["focus_keyword"] !== undefined) setBodyField(body as IDataObject, {"name":"focus_keyword","displayName":"Focus keyword","type":"string","nullable":true}, additionalFields["focus_keyword"], this, itemIndex);
    if (additionalFields["id"] !== undefined) setBodyField(body as IDataObject, {"name":"id","displayName":"Id","type":"string","format":"uuid"}, additionalFields["id"], this, itemIndex);
    if (additionalFields["is_published"] !== undefined) setBodyField(body as IDataObject, {"name":"is_published","displayName":"Is published","type":"boolean"}, additionalFields["is_published"], this, itemIndex);
    if (additionalFields["meta_description"] !== undefined) setBodyField(body as IDataObject, {"name":"meta_description","displayName":"Meta description","type":"string","nullable":true}, additionalFields["meta_description"], this, itemIndex);
    if (additionalFields["meta_title"] !== undefined) setBodyField(body as IDataObject, {"name":"meta_title","displayName":"Meta title","type":"string","nullable":true}, additionalFields["meta_title"], this, itemIndex);
    if (additionalFields["og_description"] !== undefined) setBodyField(body as IDataObject, {"name":"og_description","displayName":"Og description","type":"string","nullable":true}, additionalFields["og_description"], this, itemIndex);
    if (additionalFields["og_image"] !== undefined) setBodyField(body as IDataObject, {"name":"og_image","displayName":"Og image","type":"string","nullable":true}, additionalFields["og_image"], this, itemIndex);
    if (additionalFields["og_image_alt"] !== undefined) setBodyField(body as IDataObject, {"name":"og_image_alt","displayName":"Og image alt","type":"string","nullable":true}, additionalFields["og_image_alt"], this, itemIndex);
    if (additionalFields["og_title"] !== undefined) setBodyField(body as IDataObject, {"name":"og_title","displayName":"Og title","type":"string","nullable":true}, additionalFields["og_title"], this, itemIndex);
    if (additionalFields["published_at"] !== undefined) setBodyField(body as IDataObject, {"name":"published_at","displayName":"Published at","type":"string","format":"date-time","nullable":true}, additionalFields["published_at"], this, itemIndex);
    if (additionalFields["reading_time"] !== undefined) setBodyField(body as IDataObject, {"name":"reading_time","displayName":"Reading time","type":"string","nullable":true}, additionalFields["reading_time"], this, itemIndex);
    if (additionalFields["robots_follow"] !== undefined) setBodyField(body as IDataObject, {"name":"robots_follow","displayName":"Robots follow","type":"boolean","default":true}, additionalFields["robots_follow"], this, itemIndex);
    if (additionalFields["robots_index"] !== undefined) setBodyField(body as IDataObject, {"name":"robots_index","displayName":"Robots index","type":"boolean","default":true}, additionalFields["robots_index"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"schema_type","displayName":"Schema type","type":"string","required":true,"enum":["BlogPosting","Article","TechArticle"]}, this.getNodeParameter("schema_type", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"seo_keywords","displayName":"Seo keywords","type":"array","required":true,"items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"}, this.getNodeParameter("seo_keywords", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"slug","displayName":"Slug","type":"string","required":true,"pattern":"^[a-z0-9]+(?:-[a-z0-9]+)*$"}, this.getNodeParameter("slug", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"title","displayName":"Title","type":"string","required":true}, this.getNodeParameter("title", itemIndex), this, itemIndex);
    if (additionalFields["tldr"] !== undefined) setBodyField(body as IDataObject, {"name":"tldr","displayName":"Tldr","type":"string","nullable":true}, additionalFields["tldr"], this, itemIndex);
    if (additionalFields["twitter_description"] !== undefined) setBodyField(body as IDataObject, {"name":"twitter_description","displayName":"Twitter description","type":"string","nullable":true}, additionalFields["twitter_description"], this, itemIndex);
    if (additionalFields["twitter_image"] !== undefined) setBodyField(body as IDataObject, {"name":"twitter_image","displayName":"Twitter image","type":"string","nullable":true}, additionalFields["twitter_image"], this, itemIndex);
    if (additionalFields["twitter_image_alt"] !== undefined) setBodyField(body as IDataObject, {"name":"twitter_image_alt","displayName":"Twitter image alt","type":"string","nullable":true}, additionalFields["twitter_image_alt"], this, itemIndex);
    if (additionalFields["twitter_title"] !== undefined) setBodyField(body as IDataObject, {"name":"twitter_title","displayName":"Twitter title","type":"string","nullable":true}, additionalFields["twitter_title"], this, itemIndex);
    if (additionalFields["updated_at"] !== undefined) setBodyField(body as IDataObject, {"name":"updated_at","displayName":"Updated at","type":"string","format":"date-time"}, additionalFields["updated_at"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://0mcp.dev", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"node0mcpBlogApiApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"},"409":{"title":"Conflict"}};
        break;
      }
    case "postApiBlogsIdPublish": {
        
        
        let path = "/api/blogs/{id}/publish";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://0mcp.dev", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"node0mcpBlogApiApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"},"409":{"title":"Conflict"}};
        break;
      }
          default: throw new NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
        }
        const returnAll = pagination.style !== 'none' ? Boolean(nodeOptions.returnAll ?? false) : false;
    const resultLimit = pagination.style !== 'none' && !returnAll ? Number(nodeOptions.resultLimit ?? 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
    const pageStartTime = Date.now();
    const seenCursors = new Map<string, number>(); const seenPages = new Map<string, number>();
    let page = 1; let offset = 0; let cursor: unknown; let pagesFetched = 0; let estimatedBytes = 0; let finished = false;
    while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
      if (Date.now() - pageStartTime > pagination.maxElapsedMs) throw new NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
      const qs = options.qs as IDataObject;
      // Only the paginator's own page size is written here. It used to overwrite a
      // limit parameter the operation itself declared and the user had just set.
      if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined)) qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
      if (pagination.style === 'offset' && pagination.page) qs[pagination.page] = offset;
      if (pagination.style === 'pageNumber' && pagination.page) qs[pagination.page] = page;
      if (pagination.style === 'cursor' && pagination.cursor && cursor) qs[pagination.cursor] = cursor as string;
      const response = await requestWithRetry(this as never, options, credentialApplications, retryContract, itemIndex);
      pagesFetched += 1;
      const pageFingerprint = JSON.stringify(response);
      const pageRepeats = (seenPages.get(pageFingerprint) ?? 0) + 1;
      seenPages.set(pageFingerprint, pageRepeats);
      if (pageRepeats > pagination.repeatedPageLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
      estimatedBytes += pageFingerprint.length;
      if (estimatedBytes > pagination.maxMemoryBytes) throw new NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
      if (responsePlan.binary) {
        const binaryPayload = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
        const responseHeaders = (responsePlan.full ? ((response as IDataObject).headers as IDataObject | undefined) : undefined) ?? {};
        const contentType = String(responseHeaders['content-type'] ?? '').split(';')[0].trim() || 'application/octet-stream';
        // prepareBinaryData is what fills in fileName, fileSize and fileExtension.
        // Hand-building the binary entry produced items that downstream nodes could
        // not name or type, and discarded the response's own content type.
        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload as ArrayBuffer), undefined, contentType);
        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
        finished = true;
        continue;
      }
      const normalizedResponse = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
      const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
      if (responsePlan.envelopePath && envelopeValue === undefined) throw new NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
      const envelope = (envelopeValue ?? normalizedResponse) as IDataObject;
      const itemPath = pagination.itemPath || responsePlan.itemPath;
      const extractedItems = valueAtPath(envelope, itemPath);
      if (itemPath && extractedItems === undefined) throw new NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
      // A DELETE used to be reported as a fixed { deleted: true } with its body
      // thrown away, which lost the deleted representation and the job handle that
      // asynchronous deletes return. The body is used when there is one.
      const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse as IDataObject).length === 0));
      const values = deletedFallback
        ? [{ deleted: true }]
        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems ?? envelope];
      const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') as string : 'raw';
      const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) as string[] : [];
      for (const value of values) {
        if (output.length - outputStart >= resultLimit) break;
        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
        output.push({ json: selectResponseFields(value as IDataObject, fields), pairedItem: { item: itemIndex } });
      }
      if (!returnAll || pagination.style === 'none' || values.length === 0) { finished = true; continue; }
      if (pagination.hasMore && envelope[pagination.hasMore] === false) { finished = true; continue; }
      if (pagination.style === 'cursor') {
        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
        finished = !cursor;
        if (cursor) {
          const key = String(cursor);
          const repeats = (seenCursors.get(key) ?? 0) + 1;
          seenCursors.set(key, repeats);
          if (repeats > pagination.repeatedCursorLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
        }
      }
      if (pagination.advancement === 'offsetByItems') offset += values.length;
      if (pagination.advancement === 'incrementPage') page += 1;
    }
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
          continue;
        }
        if (error instanceof NodeApiError) {
          const status = String((error as unknown as { httpCode?: string; cause?: { statusCode?: number } }).httpCode ?? (error as unknown as { cause?: { statusCode?: number } }).cause?.statusCode ?? 'default');
          const planned = errorPlan[status] ?? errorPlan.default;
          if (planned) {
            const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
            const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
            throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex, message: planned.title, description });
          }
        }
        if (error instanceof NodeApiError) throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex });
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
      }
    }
    return [output];
  }
}
