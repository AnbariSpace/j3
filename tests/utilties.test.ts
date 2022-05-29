import {getParameterCaseInsensitive, ltrim} from "../src/utilties";

test("getParameterCaseInsensitive", async () => {
	const obj = {
		"A": 123,
		"b": 456,
	};
	expect(getParameterCaseInsensitive(obj, "a")).toBe(123);
	expect(getParameterCaseInsensitive(obj, "b")).toBe(456);
	expect(getParameterCaseInsensitive(obj, "c")).toBeUndefined();
});

test("ltrim", async () => {
	expect(ltrim("//test//", "/")).toBe("test//");
	expect(ltrim("test")).toBe("test");
});
