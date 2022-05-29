import HttpResponse from "../src/HttpResponse";
test("HttpResponse", async () => {
	const response = new HttpResponse(
		"body",
		200,
		{
			"Content-Type": "text/plain"
		},
	);
	expect(response.body).toBe("body");
});