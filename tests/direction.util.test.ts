import { describe, expect, test } from "@jest/globals";
import { removeNoneMeaningfullText } from "../direction.util";

describe("removeNoneMeaningfullText", () => {
	test("should remove markdown checked checkbox", () => {
		const input = "- [x] Hi";
		const result = removeNoneMeaningfullText(input);
		expect(result).toBe(" Hi");
	});

	test("if markdown link has name should replace link name with the file name", () => {
		const input = "[[file.pdf|سلام]] abc";
		const result = removeNoneMeaningfullText(input);
		expect(result).toBe("سلام abc");

		const noneNamedLink = "[[file.pdf]] abc";
		expect(removeNoneMeaningfullText(noneNamedLink)).toBe(noneNamedLink);
	});
});

