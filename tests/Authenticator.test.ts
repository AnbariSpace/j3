import Authenticator from "../src/Authenticator";
test("every action is allow", async () => {
	const auth = new Authenticator();
	const result = await auth.hasAccess("RANDOM-TEXT");
	expect(result).toBe(true);

	await expect(auth.mustHasAccess("RANDOM-TEXT")).resolves.toBeUndefined();
});