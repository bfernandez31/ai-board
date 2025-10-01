/**
 * Contract Test: POST /api/tickets
 *
 * This test verifies that the API implementation matches the OpenAPI contract.
 * It must FAIL initially (Red) before implementation, then PASS after implementation (Green).
 *
 * Run: npx playwright test contracts/api-tickets-post.test.ts
 */

import { test, expect } from "@playwright/test";

const API_BASE_URL = "http://localhost:3000";
const ENDPOINT = "/api/tickets";

test.describe("POST /api/tickets - Contract Tests", () => {
  test.describe("Success Cases (201 Created)", () => {
    test("should create ticket with valid title and description", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "Implement user authentication",
          description: "Add JWT-based authentication with login and registration endpoints.",
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body).toMatchObject({
        id: expect.any(Number),
        title: "Implement user authentication",
        description: "Add JWT-based authentication with login and registration endpoints.",
        stage: "INBOX",
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    test("should create ticket with minimal valid input (1 char each)", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "A",
          description: "B",
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.title).toBe("A");
      expect(body.description).toBe("B");
      expect(body.stage).toBe("INBOX");
    });

    test("should create ticket with maximum length title (100 chars)", async ({ request }) => {
      const maxTitle = "a".repeat(100);
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
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

    test("should create ticket with maximum length description (1000 chars)", async ({ request }) => {
      const maxDescription = "a".repeat(1000);
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "Test ticket",
          description: maxDescription,
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.description).toBe(maxDescription);
      expect(body.description.length).toBe(1000);
    });

    test("should create ticket with allowed punctuation", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "Test, ticket! How? Yes-it works.",
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

    test("should trim whitespace from title and description", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "  Trimmed title  ",
          description: "  Trimmed description  ",
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.title).toBe("Trimmed title");
      expect(body.description).toBe("Trimmed description");
    });
  });

  test.describe("Validation Errors (400 Bad Request)", () => {
    test("should reject empty title", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "",
          description: "Valid description",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeTruthy(); // Error message now includes field details
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.details.fieldErrors.title).toContain("Title is required");
    });

    test("should reject whitespace-only title", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "   ",
          description: "Valid description",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.title).toContain("Title is required");
    });

    test("should reject empty description", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "Valid title",
          description: "",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBeTruthy(); // Error message now includes field details
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.details.fieldErrors.description).toContain("Description is required");
    });

    test("should reject whitespace-only description", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "Valid title",
          description: "   ",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.description).toContain("Description is required");
    });

    test("should reject title longer than 100 characters", async ({ request }) => {
      const tooLongTitle = "a".repeat(101);
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: tooLongTitle,
          description: "Valid description",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.title).toContain("Title must be 100 characters or less");
    });

    test("should reject description longer than 1000 characters", async ({ request }) => {
      const tooLongDescription = "a".repeat(1001);
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "Valid title",
          description: tooLongDescription,
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.description).toContain("Description must be 1000 characters or less");
    });

    test("should reject title with special characters (emoji)", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "Test ticket 🚀",
          description: "Valid description",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.title).toContain("can only contain letters, numbers, and basic punctuation");
    });

    test("should reject title with special characters (@#$%)", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "Test @#$% ticket",
          description: "Valid description",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.title).toContain("can only contain letters, numbers, and basic punctuation");
    });

    test("should reject description with special characters", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "Valid title",
          description: "Invalid description with @#$% characters",
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.description).toContain("can only contain letters, numbers, and basic punctuation");
    });

    test("should reject missing title field", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          description: "Valid description",
          // title missing
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.title).toBeDefined();
    });

    test("should reject missing description field", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "Valid title",
          // description missing
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.details.fieldErrors.description).toBeDefined();
    });

    test("should reject empty request body", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
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
    test("should return 500 for database errors", async ({ request }) => {
      // This test requires database to be down or mocked
      // Skip if database is healthy
      test.skip(true, "Requires database to be unavailable");

      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "Valid title",
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
    test("should return all required fields in success response", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "Schema test",
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

    test("should return proper error structure for validation errors", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}${ENDPOINT}`, {
        data: {
          title: "",
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