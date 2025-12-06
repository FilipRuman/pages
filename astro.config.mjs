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
          label: "⛰️",
          items: [
            {
              label: "PROCEDURAL TERRAIN GENERATION",
              link: "https://github.com/FilipRuman/proceduralMapGen",
              attrs: {
                target: "_blank",
                style: "font-style: bold;font-size: 20px; text-align:center",
              },
            },
            { slug: "procedural_terrain_generation/preamble" },
            { slug: "procedural_terrain_generation/basic_setup" },
            { slug: "procedural_terrain_generation/ground_textures" },
            {
              slug: "procedural_terrain_generation/terrain_generation_quality_improvements",
            },
            { slug: "procedural_terrain_generation/performane_improvements" },
            { slug: "procedural_terrain_generation/spawning_small_objects" },
            { slug: "procedural_terrain_generation/spawning_large_structures" },
          ],
        },
        {
          label: "🖥️",
          items: [
            {
              label: "C COMPILER WRITTEN IN RUST",
              link: "https://github.com/FilipRuman/cosinus",
              attrs: {
                target: "_blank",
                style: "font-style: bold;font-size: 20px; text-align:center",
              },
            },
            { slug: "cosinus/tst" },
          ],
        },
        {
          label: "",
          items: [
            {
              label: "C PARSER WRITTEN IN RUST",
              link: "https://github.com/FilipRuman/RIP",
              attrs: {
                target: "_blank",
                style: "font-style: bold;font-size: 20px; text-align:center",
              },
            },
            { slug: "parser/preamble" },
            { slug: "parser/setup" },
            { slug: "parser/lexer" },
            { slug: "parser/basic_parser" },
            { slug: "parser/type_parsing_functions" },
            { slug: "parser/expression_parsing_functions" },
          ],
        },
      ],
    }),
  ],
});
