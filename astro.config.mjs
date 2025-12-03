// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightUtils from "@lorenzo_lewis/starlight-utils";
import starlightImageZoom from "starlight-image-zoom";
export default defineConfig({
  site: "https://filipruman.github.io",
  base: "/pages",
  integrations: [
    starlight({
      customCss: [
        // Relative path to your @font-face CSS file.
        "./src/fonts/font-face.css",
        "./src/styles/galaxy.css",
        "./src/styles/toc.css",
        "./src/styles/expressive-code.css",
        "./src/styles/markdown.css",

        "./src/styles/assides.css",
      ],
      title: "FR",

      components: {
        Header: "./src/overrides/Header.astro",
        ThemeSelect: "./src/overrides/ThemeSelect.astro",
      },
      plugins: [
        starlightImageZoom(),
        starlightUtils({
          multiSidebar: true,
        }),
      ],
      expressiveCode: {
        themes: ["dark-plus", "light-plus"],
        styleOverrides: {
          borderRadius: "0.4rem",
          frames: {
            // editorActiveTabIndicatorTopColor: "unset",
            // frameBoxShadowCssValue: "unset",
          },
        },
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/FilipRuman",
        },
      ],
      sidebar: [
        {
          label: "cosinus",
          items: [
            { slug: "cosinus/tst" },
            {
              label: "Source code  ",
              link: "https://github.com/FilipRuman/cosinus",
            },
          ],
        },
        {
          label: "c parser",
          items: [
            { slug: "parser/preamble" },
            { slug: "parser/setup" },
            { slug: "parser/lexer" },
            { slug: "parser/basic_parser" },
            { slug: "parser/type_parsing_functions" },
            { slug: "parser/expression_parsing_functions" },

            {
              label: "Source code  ",
              link: "https://github.com/FilipRuman/RIP",
            },
          ],
        },
      ],
    }),
  ],
});
