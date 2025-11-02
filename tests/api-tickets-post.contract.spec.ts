/**
 * Contract Test: POST /api/projects/${projectId}/tickets
 *
 * This test verifies that the API implementation matches the OpenAPI contract.
 * It must FAIL initially (Red) before implementation, then PASS after implementation (Green).
 *
 * Run: npx playwright test contracts/api-tickets-post.test.ts
 */

import { test, expect } from './helpers/worker-isolation';
import { cleanupDatabase } from './helpers/db-cleanup';

const API_BASE_URL = "http://localhost:3000";

test.describe("POST /api/projects/${projectId}/tickets - Contract Tests", () => {
  test.beforeEach(async ({ projectId }) => {
    // Clean database before each test
    await cleanupDatabase();
  });
  test.describe("Success Cases (201 Created)", () => {
    test("should create ticket with valid title and description", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Implement user authentication',
          description: "Add JWT-based authentication with login and registration endpoints.",
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body).toMatchObject({
        id: expect.any(Number),
        title: '[e2e] Implement user authentication',
        description: "Add JWT-based authentication with login and registration endpoints.",
        stage: "INBOX",
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    test("should create ticket with minimal valid input (1 char each)", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] A',
          description: "B",
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.title).toBe("[e2e] A");
      expect(body.description).toBe("B");
      expect(body.stage).toBe("INBOX");
    });

    test("should create ticket with maximum length title (100 chars)", async ({ request , projectId }) => {
      const maxTitle = "a".repeat(100);
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: maxTitle,
          description: "Test description",
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.title).toBe(maxTitle);
      expect(body.title.length).toBe(100);
    });

    test("should create ticket with maximum length description (2500 chars)", async ({ request , projectId }) => {
      const maxDescription = "a".repeat(2500);
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Test ticket',
          description: maxDescription,
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.description).toBe(maxDescription);
      expect(body.description.length).toBe(2500);
    });

    test("should create ticket with allowed punctuation", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Test, ticket! How? Yes-it works.',
          description: "This description has periods, commas, hyphens, spaces, question marks, and exclamation points!",
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.title).toContain(".");
      expect(body.title).toContain(",");
      expect(body.title).toContain("?");
      expect(body.title).toContain("!");
      expect(body.title).toContain("-");
    });

    test("should create title with special characters (@#$%)", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Test @#$%[] ticket',
          description: "Valid description",
        },
      });

      expect(response.status()).toBe(201);

    });



    test("should trim whitespace from title and description", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: ' [e2e] Trimmed title  ',
          description: " Trimmed description  ",
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.title).toBe("[e2e] Trimmed title");
      expect(body.description).toBe("Trimmed description");
    });
  });

  test.describe("Validation Errors (400 Bad Request)", () => {
    test("should reject empty title", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '',
          description: "Valid description",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeTruthy(); // Error message now includes field details
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.details.fieldErrors.title).toContain("Title is required");
    });

    test("should reject whitespace-only title", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '    ',
          description: "Valid description",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.title).toContain("Title is required");
    });

    test("should reject empty description", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Valid title',
          description: "",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeTruthy(); // Error message now includes field details
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.details.fieldErrors.description).toContain("Description is required");
    });

    test("should reject whitespace-only description", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Valid title',
          description: "   ",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.description).toContain("Description is required");
    });

    test("should reject title longer than 100 characters", async ({ request , projectId }) => {
      const tooLongTitle = "a".repeat(101);
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: tooLongTitle,
          description: "Valid description",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.title).toContain("Title must be 100 characters or less");
    });

    test("should reject description longer than 2500 characters", async ({ request , projectId }) => {
      const tooLongDescription = "a".repeat(2501);
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Valid title',
          description: tooLongDescription,
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.description).toContain("Description must be 2500 characters or less");
    });

    test("should reject title with special characters (emoji)", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Test ticket 🚀',
          description: "Valid description",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.title).toContain("can only contain letters, numbers, spaces, and common special characters");
    });

    test("should accept description with emoji characters", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Valid title',
          description: "Valid description with emoji 🚀 characters",
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.description).toBe("Valid description with emoji 🚀 characters");
    });

    test("should reject missing title field", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          description: "Valid description",
          // title missing
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.title).toBeDefined();
    });

    test("should reject missing description field", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Valid title',
          // description missing
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.description).toBeDefined();
    });

    test("should reject empty request body", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {},
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeTruthy(); // Error message now includes field details
      expect(body.details.fieldErrors.title).toBeDefined();
      expect(body.details.fieldErrors.description).toBeDefined();
    });
  });

  test.describe("Error Cases", () => {
    test("should return 500 for database errors", async ({ request , projectId }) => {
      // This test requires database to be down or mocked
      // Skip if database is healthy
      test.skip(true, "Requires database to be unavailable");

      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Valid title',
          description: "Valid description",
        },
      });

      expect(response.status()).toBe(500);

      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.code).toBeDefined();
    });
  });

  test.describe("Response Schema Validation", () => {
    test("should return all required fields in success response", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Schema test',
          description: "Testing response schema",
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();

      // Required fields
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("title");
      expect(body).toHaveProperty("description");
      expect(body).toHaveProperty("stage");
      expect(body).toHaveProperty("createdAt");
      expect(body).toHaveProperty("updatedAt");

      // Type validation
      expect(typeof body.id).toBe("number");
      expect(typeof body.title).toBe("string");
      expect(typeof body.description).toBe("string");
      expect(typeof body.stage).toBe("string");
      expect(typeof body.createdAt).toBe("string");
      expect(typeof body.updatedAt).toBe("string");

      // Enum validation
      expect(["INBOX", "PLAN", "BUILD", "VERIFY", "SHIP"]).toContain(body.stage);

      // New tickets always start in INBOX
      expect(body.stage).toBe("INBOX");
    });

    test("should return proper error structure for validation errors", async ({ request , projectId }) => {
      const response = await request.post(`${API_BASE_URL}/api/projects/${projectId}/tickets`, {
        data: {
          title: '',
          description: "",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();

      // Required error fields
      expect(body).toHaveProperty("error");
      expect(typeof body.error).toBe("string");

      // Optional but expected fields
      expect(body).toHaveProperty("code");
      expect(body).toHaveProperty("details");
      expect(body.details).toHaveProperty("fieldErrors");

      // fieldErrors should be an object with arrays
      expect(typeof body.details.fieldErrors).toBe("object");
      expect(Array.isArray(body.details.fieldErrors.title)).toBe(true);
      expect(Array.isArray(body.details.fieldErrors.description)).toBe(true);
    });
  });
});
