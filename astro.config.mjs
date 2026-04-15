// @ts-check

import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightUtils from "@lorenzo_lewis/starlight-utils";
import starlightImageZoom from "starlight-image-zoom";
import sitemap from "@astrojs/sitemap";
export default defineConfig({
  site: "https://filip-ruman.pages.dev/",
  base: "/",
  integrations: [starlight({
      logo: {
        src: './public/AlpacaNoLines.png',
        replacesTitle: true,
      },
      head: [
                {
                  tag: "meta",
                  attrs: {
                    name: "google-site-verification",
                    content: "hY0iKDHZST_WcCCaSmemFiD7iyldwqm-MLiqnI18c_I"
                  }
                },
        
                {
                  tag: "script",
                  attrs: {
                    async: true,
                    src: "https://www.googletagmanager.com/gtag/js?id=G-MQ2T63NLMT"
                  }
                },

                {
                  tag: "script",
                  content: `
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', 'G-MQ2T63NLMT');
                  `
                },
                 {
                   tag: "link",
                   attrs: {
                     rel: "shortcut icon",
                     type:"image/svg+xml",
                     href: "/AlpacaLines.svg"
                   }
                 },
                {
                  tag: "link",
                  attrs: {
                    rel: "sitemap",
                    href: "/sitemap-index.xml"
                  }
                }
      ],
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
              link: "https://github.com/FilipRuman/procedural_terrain_generationV2",
              attrs: {
                target: "_blank",
                style: "font-style: bold;font-size: 20px; text-align:center",
              },
            },
            { slug: "terrain_gen/overview/overview" },
            { slug: "terrain_gen/basic_ground_mesh/basic_ground_mesh" },
            { slug: "terrain_gen/ground_shader/ground_shader" },
            { slug: "terrain_gen/chunked_terrain_generation/chunked_terrain_generation" },
            { slug: "terrain_gen/generating_biome_data/generating_biome_data" },
            { slug: "terrain_gen/ilmg/ilmg" },
          ],
        },

      {
        label: "",
        items: [
          {
            label: "NIXOS CONFIGURATION",
            link: "https://github.com/FilipRuman/NNC",
            attrs: {
              target: "_blank",
              style: "font-style: bold;font-size: 20px; text-align:center",
            },
          },
          { slug: "nixos_config/resons_for_using_nixos" },
          { slug: "nixos_config/overview" },
          { slug: "nixos_config/config_structure" },
          { slug: "nixos_config/quick_installation" },
          { slug: "nixos_config/usefull_flakes" },
          { slug: "nixos_config/rice" },
          { slug: "nixos_config/other_tips" },
        ],
      },
      {
        label: "󰳳",
        items: [
          {
            label: "One shots",
            link: "https://github.com/FilipRuman",
            attrs: {
              target: "_blank",
              style: "font-style: bold;font-size: 20px; text-align:center",
            },
          },
          { slug: "one_shot/godot_debugging" },
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
          { slug: "parser/overview" },
          { slug: "parser/setup" },
          { slug: "parser/lexer" },
          { slug: "parser/basic_parser" },
          { slug: "parser/type_parsing_functions" },
          { slug: "parser/expression_parsing_functions" },
        ],
      },
    ],
  }), sitemap()],
});
