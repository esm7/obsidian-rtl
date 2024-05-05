import { describe, expect, test } from "@jest/globals";
import { autoDirectionPostProcessor } from "../AutoDirPostProcessor";

describe("AutoDirPostProcessor", () => {
  test("special node should not change parent element direction if there is text with decidable direction before", () => {
    const rtlHTML = convertToHTMLElement(
      `<div><p>سلام، <em>Hello</em></p></div>`,
    );
    autoDirectionPostProcessor(rtlHTML, null, null);
    expect(rtlHTML.outerHTML).toBe(
      `<div><p class="esm-rtl">سلام، <em>Hello</em></p></div>`,
    );

    const ltrHTML = convertToHTMLElement(
      `<div><p>Hello, <em>سلام</em></p></div>`,
    );
    autoDirectionPostProcessor(ltrHTML, null, null);
    expect(ltrHTML.outerHTML).toBe(
      `<div><p class="esm-ltr">Hello, <em>سلام</em></p></div>`,
    );
  });

  test("special node should change parent element direction if there isn't text with decidable direction before", () => {
    const html = convertToHTMLElement(`<div><p>[<em>سلام</em></p>]</div>`);
    autoDirectionPostProcessor(html, null, null);
    expect(html.outerHTML).toBe(
      `<div><p class="esm-rtl">[<em>سلام</em></p>]</div>`,
    );
  });
});

function convertToHTMLElement(str: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = str;
  return template.content.firstChild as HTMLElement;
}
