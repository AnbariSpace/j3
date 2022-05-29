import { container } from "tsyringe";
import Router from "../src/Router";
import { setupConfigForTest, cleanupAfterTest } from "./TestHelper";
import httpMocks from "node-mocks-http";
import Config from "../src/Config";
import { GetObject, ListBuckets, ListObjects, PutObject } from "../src/S3Actions";


beforeAll(() => setupConfigForTest());
afterAll(() => cleanupAfterTest());

test("ListBuckets", async () => {
	const config = container.resolve(Config);
	const router = container.resolve(Router);
	const request = httpMocks.createRequest({
		method: "GET",
		path: "/",
		headers: {
			host: config.data["public-domain"]
		},
	});
	const action = router.findAction(request);
	expect(action).toBeInstanceOf(ListBuckets);
	if (action !== undefined) {
		expect(action.request).toBe(request);
	}
});

test("Action with wrong method", async () => {
	const config = container.resolve(Config);
	const router = container.resolve(Router);
	const result1 = router.findAction(httpMocks.createRequest({
		method: "POST",
		path: "/",
		headers: {
			host: config.data["public-domain"]
		},
	}));
	expect(result1).toBeUndefined();
});

test("Request with invalid http host", async () => {
	const router = container.resolve(Router);
	
	const result1 = router.findAction(httpMocks.createRequest({
		method: "GET",
		path: "/",
		headers: {
			host: "non-valid-domain",
		},
	}));
	expect(result1).toBeUndefined();

	const result2 = router.findAction(httpMocks.createRequest({
		method: "GET",
		path: "/",
	}));
	expect(result2).toBeUndefined();
});

test("ListObjects with virtual-directory style", async () => {
	const config = container.resolve(Config);
	const router = container.resolve(Router);
	
	const result = router.findAction(httpMocks.createRequest({
		method: "GET",
		url: "/my-bucket?" + (new URLSearchParams({
			prefix: "my-prefix",
			delimiter: "/"
		})),
		headers: {
			host: config.data["public-domain"],
		},
	}));
	expect(result).toBeInstanceOf(ListObjects);
	if (result instanceof ListObjects) {
		expect(result.Bucket).toBe("my-bucket");
		expect(result.prefix).toBe("my-prefix");
		expect(result["start-after"]).toBeUndefined();
	}
});

test("ListObjects with virtual-host style", async () => {
	const config = container.resolve(Config);
	const router = container.resolve(Router);
	
	const result = router.findAction(httpMocks.createRequest({
		method: "GET",
		url: "/?" + (new URLSearchParams({
			prefix: "my-prefix",
			delimiter: "/"
		})),
		headers: {
			host: `my-bucket.${config.data["public-domain"]}`,
		},
	}));

	expect(result).toBeInstanceOf(ListObjects);
	if (result instanceof ListObjects) {
		expect(result.Bucket).toBe("my-bucket");
		expect(result.prefix).toBe("my-prefix");
		expect(result["start-after"]).toBeUndefined();
	}
});


test("GetObject with virtual-directory style", async () => {
	const config = container.resolve(Config);
	const router = container.resolve(Router);

	const result = router.findAction(httpMocks.createRequest({
		method: "GET",
		url: "/my-bucket/my-object.txt",
		headers: {
			host: config.data["public-domain"],
		},
	}));
	expect(result).toBeInstanceOf(GetObject);
	if (result instanceof GetObject) {
		expect(result.Bucket).toBe("my-bucket");
		expect(result.Key).toBe("my-object.txt");
	}
});

test("GetObject with virtual-host style", async () => {
	const config = container.resolve(Config);
	const router = container.resolve(Router);

	const result = router.findAction(httpMocks.createRequest({
		method: "GET",
		url: "/my-object.txt",
		headers: {
			host: `my-bucket.${config.data["public-domain"]}`,
		},
	}));
	expect(result).toBeInstanceOf(GetObject);
	if (result instanceof GetObject) {
		expect(result.Bucket).toBe("my-bucket");
		expect(result.Key).toBe("my-object.txt");
	}
});

test("PutObject with virtual-directory style", async () => {
	const config = container.resolve(Config);
	const router = container.resolve(Router);

	const result = router.findAction(httpMocks.createRequest({
		method: "PUT",
		url: "my-bucket/my-object.txt",
		headers: {
			host: config.data["public-domain"],
			"Content-Length": "4",
		},
	}));
	expect(result).toBeInstanceOf(PutObject);
	if (result instanceof PutObject) {
		expect(result.Bucket).toBe("my-bucket");
		expect(result.Key).toBe("my-object.txt");
		expect(result["Content-Length"]).toBe("4");
	}
});