"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Node0mcpBlogApi = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const http_1 = require("../../shared/http");
function normalizeParameterValue(value) {
    if (value && typeof value === 'object' && 'value' in value)
        return value.value;
    return value;
}
function normalizeJsonValue(value, label, context, itemIndex) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return {};
        try {
            return JSON.parse(trimmed);
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON: ${error.message}`, { itemIndex });
        }
    }
    if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value;
    throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}
function validateBodyValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c, _d, _e;
    if (value === undefined || value === '') {
        if (contract.required)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
        return;
    }
    if (value === null) {
        if (contract.nullable)
            return;
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
    }
    if ((_a = contract.alternatives) === null || _a === void 0 ? void 0 : _a.length) {
        selectAlternativeValue(value, contract, path, context, itemIndex);
        return;
    }
    if (contract.type === 'string' && typeof value !== 'string')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
    if (contract.type === 'boolean' && typeof value !== 'boolean')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
    if (contract.type === 'number' && typeof value !== 'number')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
    if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value)))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
    if ((_b = contract.enum) === null || _b === void 0 ? void 0 : _b.length) {
        const enumValueMatches = (candidate) => candidate === value ||
            (candidate === null && value === 'null') ||
            (candidate === 'null' && value === null) ||
            Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
        const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
        const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
            ? value.every((item) => contract.enum.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
            : contract.enum.some(enumValueMatches);
        if (!matches)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
    }
    if (contract.type === 'number' || contract.type === 'integer') {
        const numeric = value;
        if (contract.minValue !== undefined && numeric < contract.minValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
        if (contract.maxValue !== undefined && numeric > contract.maxValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
    }
    if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
    if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
    if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
        try {
            new URL(value);
        }
        catch {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
        }
    }
    if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
    if (contract.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
        const objectValue = value;
        for (const child of (_c = contract.fields) !== null && _c !== void 0 ? _c : [])
            validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
        if (contract.additionalValue) {
            const known = new Set(((_d = contract.fields) !== null && _d !== void 0 ? _d : []).map((field) => field.name));
            for (const [key, childValue] of Object.entries(objectValue)) {
                if (!known.has(key)) {
                    if (((_e = contract.additionalValue.alternatives) === null || _e === void 0 ? void 0 : _e.length) && contract.additionalValue.representation === 'raw')
                        continue;
                    validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
                }
            }
        }
    }
    if (contract.type === 'array') {
        if (!Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
        if (contract.items)
            value.forEach((item, index) => validateBodyValue(item, contract.items, `${path}[${index}]`, context, itemIndex));
    }
}
function setBodyField(body, contract, value, context, itemIndex) {
    var _a, _b;
    const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
        ? normalizeJsonValue(value, (_a = contract.displayName) !== null && _a !== void 0 ? _a : contract.name, context, itemIndex)
        : normalizeParameterValue(value);
    const selected = ((_b = contract.alternatives) === null || _b === void 0 ? void 0 : _b.length) ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
    validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
    body[contract.name] = selected;
}
function selectAlternativeValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
    const selectedName = String((_a = value.schemaAlternative) !== null && _a !== void 0 ? _a : '');
    const selected = ((_b = contract.alternatives) !== null && _b !== void 0 ? _b : []).find((alternative) => alternative.name === selectedName);
    if (!selected)
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${((_c = contract.alternatives) !== null && _c !== void 0 ? _c : []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
    const selectedValue = value.value;
    validateBodyValue(selectedValue, selected, path, context, itemIndex);
    return selectedValue;
}
function selectResponseFields(value, fields) {
    if (fields.length === 0)
        return value;
    const selected = {};
    if (value.id !== undefined)
        selected.id = value.id;
    for (const field of fields)
        if (value[field] !== undefined)
            selected[field] = value[field];
    return selected;
}
function valueAtPath(value, path) {
    if (!path)
        return value;
    return path.split('.').filter(Boolean).reduce((current, segment) => {
        if (current === undefined || current === null)
            return undefined;
        if (Array.isArray(current))
            return current[Number(segment)];
        return current[segment];
    }, value);
}
class Node0mcpBlogApi {
    constructor() {
        this.description = {
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
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            outputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
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
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const inputItems = this.getInputData();
        const output = [];
        for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
            const outputStart = output.length;
            let errorPlan = {};
            try {
                const operation = this.getNodeParameter('operation', itemIndex);
                const nodeVersion = this.getNode().typeVersion;
                let additionalFields = {};
                const nodeOptions = this.getNodeParameter('options', itemIndex, {});
                let retryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
                let credentialApplications;
                let options;
                let pagination = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                let responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                switch (operation) {
                    case "deleteApiBlogsId": {
                        let path = "/api/blogs/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://0mcp.dev", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "node0mcpBlogApiApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request" }, "401": { "title": "Unauthorized" }, "404": { "title": "Not found" }, "409": { "title": "Conflict" } };
                        break;
                    }
                    case "getApiBlogs": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/api/blogs";
                        const qs = {};
                        const body = {};
                        if (additionalFields["status"] !== undefined)
                            qs["status"] = additionalFields["status"];
                        if (additionalFields["category"] !== undefined)
                            qs["category"] = additionalFields["category"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["page_size"] !== undefined)
                            qs["page_size"] = additionalFields["page_size"];
                        const serverBaseUrl = { url: "https://0mcp.dev", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "node0mcpBlogApiApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["pagination", "posts"], simplified: ["pagination", "posts"] };
                        errorPlan = { "400": { "title": "Invalid request" }, "401": { "title": "Unauthorized" }, "404": { "title": "Not found" }, "409": { "title": "Conflict" } };
                        break;
                    }
                    case "getApiBlogsId": {
                        let path = "/api/blogs/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://0mcp.dev", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "node0mcpBlogApiApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request" }, "401": { "title": "Unauthorized" }, "404": { "title": "Not found" }, "409": { "title": "Conflict" } };
                        break;
                    }
                    case "patchApiBlogsId": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/blogs/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["authors"] !== undefined)
                            setBodyField(body, { "name": "authors", "displayName": "Authors", "type": "array", "items": { "name": "item", "displayName": "Item", "type": "object", "fields": [{ "name": "avatar", "displayName": "Avatar", "type": "string" }, { "name": "bio", "displayName": "Bio", "type": "string" }, { "name": "name", "displayName": "Name", "type": "string", "required": true }, { "name": "profile_url", "displayName": "Profile url", "type": "string" }, { "name": "role", "displayName": "Role", "type": "string" }], "representation": "raw" }, "representation": "raw" }, additionalFields["authors"], this, itemIndex);
                        if (additionalFields["canonical_url"] !== undefined)
                            setBodyField(body, { "name": "canonical_url", "displayName": "Canonical url", "type": "string", "nullable": true }, additionalFields["canonical_url"], this, itemIndex);
                        setBodyField(body, { "name": "category", "displayName": "Category", "type": "string", "required": true, "enum": ["Engineering", "Announcements", "News", "Guides", "Product"] }, this.getNodeParameter("category", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "content", "displayName": "Content", "type": "string", "required": true, "description": "HTML" }, this.getNodeParameter("content", itemIndex), this, itemIndex);
                        if (additionalFields["created_at"] !== undefined)
                            setBodyField(body, { "name": "created_at", "displayName": "Created at", "type": "string", "format": "date-time" }, additionalFields["created_at"], this, itemIndex);
                        setBodyField(body, { "name": "description", "displayName": "Description", "type": "string", "required": true }, this.getNodeParameter("description", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "faq_content", "displayName": "Faq content", "type": "array", "required": true, "items": { "name": "item", "displayName": "Item", "type": "object", "fields": [{ "name": "answer", "displayName": "Answer", "type": "string", "required": true }, { "name": "question", "displayName": "Question", "type": "string", "required": true }], "representation": "raw" }, "representation": "raw" }, this.getNodeParameter("faq_content", itemIndex), this, itemIndex);
                        if (additionalFields["featured_image"] !== undefined)
                            setBodyField(body, { "name": "featured_image", "displayName": "Featured image", "type": "string", "nullable": true }, additionalFields["featured_image"], this, itemIndex);
                        if (additionalFields["featured_image_alt"] !== undefined)
                            setBodyField(body, { "name": "featured_image_alt", "displayName": "Featured image alt", "type": "string", "nullable": true }, additionalFields["featured_image_alt"], this, itemIndex);
                        if (additionalFields["focus_keyword"] !== undefined)
                            setBodyField(body, { "name": "focus_keyword", "displayName": "Focus keyword", "type": "string", "nullable": true }, additionalFields["focus_keyword"], this, itemIndex);
                        if (additionalFields["idBody"] !== undefined)
                            setBodyField(body, { "name": "id", "displayName": "Id", "type": "string", "format": "uuid" }, additionalFields["idBody"], this, itemIndex);
                        if (additionalFields["is_published"] !== undefined)
                            setBodyField(body, { "name": "is_published", "displayName": "Is published", "type": "boolean" }, additionalFields["is_published"], this, itemIndex);
                        if (additionalFields["meta_description"] !== undefined)
                            setBodyField(body, { "name": "meta_description", "displayName": "Meta description", "type": "string", "nullable": true }, additionalFields["meta_description"], this, itemIndex);
                        if (additionalFields["meta_title"] !== undefined)
                            setBodyField(body, { "name": "meta_title", "displayName": "Meta title", "type": "string", "nullable": true }, additionalFields["meta_title"], this, itemIndex);
                        if (additionalFields["og_description"] !== undefined)
                            setBodyField(body, { "name": "og_description", "displayName": "Og description", "type": "string", "nullable": true }, additionalFields["og_description"], this, itemIndex);
                        if (additionalFields["og_image"] !== undefined)
                            setBodyField(body, { "name": "og_image", "displayName": "Og image", "type": "string", "nullable": true }, additionalFields["og_image"], this, itemIndex);
                        if (additionalFields["og_image_alt"] !== undefined)
                            setBodyField(body, { "name": "og_image_alt", "displayName": "Og image alt", "type": "string", "nullable": true }, additionalFields["og_image_alt"], this, itemIndex);
                        if (additionalFields["og_title"] !== undefined)
                            setBodyField(body, { "name": "og_title", "displayName": "Og title", "type": "string", "nullable": true }, additionalFields["og_title"], this, itemIndex);
                        if (additionalFields["published_at"] !== undefined)
                            setBodyField(body, { "name": "published_at", "displayName": "Published at", "type": "string", "format": "date-time", "nullable": true }, additionalFields["published_at"], this, itemIndex);
                        if (additionalFields["reading_time"] !== undefined)
                            setBodyField(body, { "name": "reading_time", "displayName": "Reading time", "type": "string", "nullable": true }, additionalFields["reading_time"], this, itemIndex);
                        if (additionalFields["robots_follow"] !== undefined)
                            setBodyField(body, { "name": "robots_follow", "displayName": "Robots follow", "type": "boolean", "default": true }, additionalFields["robots_follow"], this, itemIndex);
                        if (additionalFields["robots_index"] !== undefined)
                            setBodyField(body, { "name": "robots_index", "displayName": "Robots index", "type": "boolean", "default": true }, additionalFields["robots_index"], this, itemIndex);
                        setBodyField(body, { "name": "schema_type", "displayName": "Schema type", "type": "string", "required": true, "enum": ["BlogPosting", "Article", "TechArticle"] }, this.getNodeParameter("schema_type", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "seo_keywords", "displayName": "Seo keywords", "type": "array", "required": true, "items": { "name": "item", "displayName": "Item", "type": "string" }, "representation": "raw" }, this.getNodeParameter("seo_keywords", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "slug", "displayName": "Slug", "type": "string", "required": true, "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$" }, this.getNodeParameter("slug", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "title", "displayName": "Title", "type": "string", "required": true }, this.getNodeParameter("title", itemIndex), this, itemIndex);
                        if (additionalFields["tldr"] !== undefined)
                            setBodyField(body, { "name": "tldr", "displayName": "Tldr", "type": "string", "nullable": true }, additionalFields["tldr"], this, itemIndex);
                        if (additionalFields["twitter_description"] !== undefined)
                            setBodyField(body, { "name": "twitter_description", "displayName": "Twitter description", "type": "string", "nullable": true }, additionalFields["twitter_description"], this, itemIndex);
                        if (additionalFields["twitter_image"] !== undefined)
                            setBodyField(body, { "name": "twitter_image", "displayName": "Twitter image", "type": "string", "nullable": true }, additionalFields["twitter_image"], this, itemIndex);
                        if (additionalFields["twitter_image_alt"] !== undefined)
                            setBodyField(body, { "name": "twitter_image_alt", "displayName": "Twitter image alt", "type": "string", "nullable": true }, additionalFields["twitter_image_alt"], this, itemIndex);
                        if (additionalFields["twitter_title"] !== undefined)
                            setBodyField(body, { "name": "twitter_title", "displayName": "Twitter title", "type": "string", "nullable": true }, additionalFields["twitter_title"], this, itemIndex);
                        if (additionalFields["updated_at"] !== undefined)
                            setBodyField(body, { "name": "updated_at", "displayName": "Updated at", "type": "string", "format": "date-time" }, additionalFields["updated_at"], this, itemIndex);
                        const serverBaseUrl = { url: "https://0mcp.dev", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "node0mcpBlogApiApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request" }, "401": { "title": "Unauthorized" }, "404": { "title": "Not found" }, "409": { "title": "Conflict" } };
                        break;
                    }
                    case "postApiBlogs": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/api/blogs";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["authors"] !== undefined)
                            setBodyField(body, { "name": "authors", "displayName": "Authors", "type": "array", "items": { "name": "item", "displayName": "Item", "type": "object", "fields": [{ "name": "avatar", "displayName": "Avatar", "type": "string" }, { "name": "bio", "displayName": "Bio", "type": "string" }, { "name": "name", "displayName": "Name", "type": "string", "required": true }, { "name": "profile_url", "displayName": "Profile url", "type": "string" }, { "name": "role", "displayName": "Role", "type": "string" }], "representation": "raw" }, "representation": "raw" }, additionalFields["authors"], this, itemIndex);
                        if (additionalFields["canonical_url"] !== undefined)
                            setBodyField(body, { "name": "canonical_url", "displayName": "Canonical url", "type": "string", "nullable": true }, additionalFields["canonical_url"], this, itemIndex);
                        setBodyField(body, { "name": "category", "displayName": "Category", "type": "string", "required": true, "enum": ["Engineering", "Announcements", "News", "Guides", "Product"] }, this.getNodeParameter("category", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "content", "displayName": "Content", "type": "string", "required": true, "description": "HTML" }, this.getNodeParameter("content", itemIndex), this, itemIndex);
                        if (additionalFields["created_at"] !== undefined)
                            setBodyField(body, { "name": "created_at", "displayName": "Created at", "type": "string", "format": "date-time" }, additionalFields["created_at"], this, itemIndex);
                        setBodyField(body, { "name": "description", "displayName": "Description", "type": "string", "required": true }, this.getNodeParameter("description", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "faq_content", "displayName": "Faq content", "type": "array", "required": true, "items": { "name": "item", "displayName": "Item", "type": "object", "fields": [{ "name": "answer", "displayName": "Answer", "type": "string", "required": true }, { "name": "question", "displayName": "Question", "type": "string", "required": true }], "representation": "raw" }, "representation": "raw" }, this.getNodeParameter("faq_content", itemIndex), this, itemIndex);
                        if (additionalFields["featured_image"] !== undefined)
                            setBodyField(body, { "name": "featured_image", "displayName": "Featured image", "type": "string", "nullable": true }, additionalFields["featured_image"], this, itemIndex);
                        if (additionalFields["featured_image_alt"] !== undefined)
                            setBodyField(body, { "name": "featured_image_alt", "displayName": "Featured image alt", "type": "string", "nullable": true }, additionalFields["featured_image_alt"], this, itemIndex);
                        if (additionalFields["focus_keyword"] !== undefined)
                            setBodyField(body, { "name": "focus_keyword", "displayName": "Focus keyword", "type": "string", "nullable": true }, additionalFields["focus_keyword"], this, itemIndex);
                        if (additionalFields["id"] !== undefined)
                            setBodyField(body, { "name": "id", "displayName": "Id", "type": "string", "format": "uuid" }, additionalFields["id"], this, itemIndex);
                        if (additionalFields["is_published"] !== undefined)
                            setBodyField(body, { "name": "is_published", "displayName": "Is published", "type": "boolean" }, additionalFields["is_published"], this, itemIndex);
                        if (additionalFields["meta_description"] !== undefined)
                            setBodyField(body, { "name": "meta_description", "displayName": "Meta description", "type": "string", "nullable": true }, additionalFields["meta_description"], this, itemIndex);
                        if (additionalFields["meta_title"] !== undefined)
                            setBodyField(body, { "name": "meta_title", "displayName": "Meta title", "type": "string", "nullable": true }, additionalFields["meta_title"], this, itemIndex);
                        if (additionalFields["og_description"] !== undefined)
                            setBodyField(body, { "name": "og_description", "displayName": "Og description", "type": "string", "nullable": true }, additionalFields["og_description"], this, itemIndex);
                        if (additionalFields["og_image"] !== undefined)
                            setBodyField(body, { "name": "og_image", "displayName": "Og image", "type": "string", "nullable": true }, additionalFields["og_image"], this, itemIndex);
                        if (additionalFields["og_image_alt"] !== undefined)
                            setBodyField(body, { "name": "og_image_alt", "displayName": "Og image alt", "type": "string", "nullable": true }, additionalFields["og_image_alt"], this, itemIndex);
                        if (additionalFields["og_title"] !== undefined)
                            setBodyField(body, { "name": "og_title", "displayName": "Og title", "type": "string", "nullable": true }, additionalFields["og_title"], this, itemIndex);
                        if (additionalFields["published_at"] !== undefined)
                            setBodyField(body, { "name": "published_at", "displayName": "Published at", "type": "string", "format": "date-time", "nullable": true }, additionalFields["published_at"], this, itemIndex);
                        if (additionalFields["reading_time"] !== undefined)
                            setBodyField(body, { "name": "reading_time", "displayName": "Reading time", "type": "string", "nullable": true }, additionalFields["reading_time"], this, itemIndex);
                        if (additionalFields["robots_follow"] !== undefined)
                            setBodyField(body, { "name": "robots_follow", "displayName": "Robots follow", "type": "boolean", "default": true }, additionalFields["robots_follow"], this, itemIndex);
                        if (additionalFields["robots_index"] !== undefined)
                            setBodyField(body, { "name": "robots_index", "displayName": "Robots index", "type": "boolean", "default": true }, additionalFields["robots_index"], this, itemIndex);
                        setBodyField(body, { "name": "schema_type", "displayName": "Schema type", "type": "string", "required": true, "enum": ["BlogPosting", "Article", "TechArticle"] }, this.getNodeParameter("schema_type", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "seo_keywords", "displayName": "Seo keywords", "type": "array", "required": true, "items": { "name": "item", "displayName": "Item", "type": "string" }, "representation": "raw" }, this.getNodeParameter("seo_keywords", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "slug", "displayName": "Slug", "type": "string", "required": true, "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$" }, this.getNodeParameter("slug", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "title", "displayName": "Title", "type": "string", "required": true }, this.getNodeParameter("title", itemIndex), this, itemIndex);
                        if (additionalFields["tldr"] !== undefined)
                            setBodyField(body, { "name": "tldr", "displayName": "Tldr", "type": "string", "nullable": true }, additionalFields["tldr"], this, itemIndex);
                        if (additionalFields["twitter_description"] !== undefined)
                            setBodyField(body, { "name": "twitter_description", "displayName": "Twitter description", "type": "string", "nullable": true }, additionalFields["twitter_description"], this, itemIndex);
                        if (additionalFields["twitter_image"] !== undefined)
                            setBodyField(body, { "name": "twitter_image", "displayName": "Twitter image", "type": "string", "nullable": true }, additionalFields["twitter_image"], this, itemIndex);
                        if (additionalFields["twitter_image_alt"] !== undefined)
                            setBodyField(body, { "name": "twitter_image_alt", "displayName": "Twitter image alt", "type": "string", "nullable": true }, additionalFields["twitter_image_alt"], this, itemIndex);
                        if (additionalFields["twitter_title"] !== undefined)
                            setBodyField(body, { "name": "twitter_title", "displayName": "Twitter title", "type": "string", "nullable": true }, additionalFields["twitter_title"], this, itemIndex);
                        if (additionalFields["updated_at"] !== undefined)
                            setBodyField(body, { "name": "updated_at", "displayName": "Updated at", "type": "string", "format": "date-time" }, additionalFields["updated_at"], this, itemIndex);
                        const serverBaseUrl = { url: "https://0mcp.dev", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "node0mcpBlogApiApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request" }, "401": { "title": "Unauthorized" }, "404": { "title": "Not found" }, "409": { "title": "Conflict" } };
                        break;
                    }
                    case "postApiBlogsIdPublish": {
                        let path = "/api/blogs/{id}/publish";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://0mcp.dev", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "node0mcpBlogApiApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request" }, "401": { "title": "Unauthorized" }, "404": { "title": "Not found" }, "409": { "title": "Conflict" } };
                        break;
                    }
                    default: throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
                }
                const returnAll = pagination.style !== 'none' ? Boolean((_a = nodeOptions.returnAll) !== null && _a !== void 0 ? _a : false) : false;
                const resultLimit = pagination.style !== 'none' && !returnAll ? Number((_b = nodeOptions.resultLimit) !== null && _b !== void 0 ? _b : 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
                const pageStartTime = Date.now();
                const seenCursors = new Map();
                const seenPages = new Map();
                let page = 1;
                let offset = 0;
                let cursor;
                let pagesFetched = 0;
                let estimatedBytes = 0;
                let finished = false;
                while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
                    if (Date.now() - pageStartTime > pagination.maxElapsedMs)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
                    const qs = options.qs;
                    if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined))
                        qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
                    if (pagination.style === 'offset' && pagination.page)
                        qs[pagination.page] = offset;
                    if (pagination.style === 'pageNumber' && pagination.page)
                        qs[pagination.page] = page;
                    if (pagination.style === 'cursor' && pagination.cursor && cursor)
                        qs[pagination.cursor] = cursor;
                    const response = await (0, http_1.requestWithRetry)(this, options, credentialApplications, retryContract, itemIndex);
                    pagesFetched += 1;
                    const pageFingerprint = JSON.stringify(response);
                    const pageRepeats = ((_c = seenPages.get(pageFingerprint)) !== null && _c !== void 0 ? _c : 0) + 1;
                    seenPages.set(pageFingerprint, pageRepeats);
                    if (pageRepeats > pagination.repeatedPageLimit)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
                    estimatedBytes += pageFingerprint.length;
                    if (estimatedBytes > pagination.maxMemoryBytes)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
                    if (responsePlan.binary) {
                        const binaryPayload = responsePlan.full ? ((_d = response.body) !== null && _d !== void 0 ? _d : response) : response;
                        const responseHeaders = (_e = (responsePlan.full ? response.headers : undefined)) !== null && _e !== void 0 ? _e : {};
                        const contentType = String((_f = responseHeaders['content-type']) !== null && _f !== void 0 ? _f : '').split(';')[0].trim() || 'application/octet-stream';
                        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload), undefined, contentType);
                        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
                        finished = true;
                        continue;
                    }
                    const normalizedResponse = responsePlan.full ? ((_g = response.body) !== null && _g !== void 0 ? _g : response) : response;
                    const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
                    if (responsePlan.envelopePath && envelopeValue === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
                    const envelope = (envelopeValue !== null && envelopeValue !== void 0 ? envelopeValue : normalizedResponse);
                    const itemPath = pagination.itemPath || responsePlan.itemPath;
                    const extractedItems = valueAtPath(envelope, itemPath);
                    if (itemPath && extractedItems === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
                    const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
                        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse).length === 0));
                    const values = deletedFallback
                        ? [{ deleted: true }]
                        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems !== null && extractedItems !== void 0 ? extractedItems : envelope];
                    const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') : 'raw';
                    const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) : [];
                    for (const value of values) {
                        if (output.length - outputStart >= resultLimit)
                            break;
                        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
                        output.push({ json: selectResponseFields(value, fields), pairedItem: { item: itemIndex } });
                    }
                    if (!returnAll || pagination.style === 'none' || values.length === 0) {
                        finished = true;
                        continue;
                    }
                    if (pagination.hasMore && envelope[pagination.hasMore] === false) {
                        finished = true;
                        continue;
                    }
                    if (pagination.style === 'cursor') {
                        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
                        finished = !cursor;
                        if (cursor) {
                            const key = String(cursor);
                            const repeats = ((_h = seenCursors.get(key)) !== null && _h !== void 0 ? _h : 0) + 1;
                            seenCursors.set(key, repeats);
                            if (repeats > pagination.repeatedCursorLimit)
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
                        }
                    }
                    if (pagination.advancement === 'offsetByItems')
                        offset += values.length;
                    if (pagination.advancement === 'incrementPage')
                        page += 1;
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    output.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
                    continue;
                }
                if (error instanceof n8n_workflow_1.NodeApiError) {
                    const status = String((_l = (_j = error.httpCode) !== null && _j !== void 0 ? _j : (_k = error.cause) === null || _k === void 0 ? void 0 : _k.statusCode) !== null && _l !== void 0 ? _l : 'default');
                    const planned = (_m = errorPlan[status]) !== null && _m !== void 0 ? _m : errorPlan.default;
                    if (planned) {
                        const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
                        const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex, message: planned.title, description });
                    }
                }
                if (error instanceof n8n_workflow_1.NodeApiError)
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex });
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
            }
        }
        return [output];
    }
}
exports.Node0mcpBlogApi = Node0mcpBlogApi;
//# sourceMappingURL=Node0mcpBlogApi.node.js.map