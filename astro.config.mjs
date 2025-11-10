// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightUtils from "@lorenzo_lewis/starlight-utils";
import starlightImageZoom from 'starlight-image-zoom'
// themes
import { ion } from "starlight-ion-theme";
import pagePlugin from "@pelagornis/page";
// https://astro.build/config
export default defineConfig({
  site: "https://filipruman.github.io",
  base: "/pages",
  integrations: [
    starlight({
      // customCss: [
      //   // Relative path to your @font-face CSS file.
      //   "./src/fonts/font-face.css",
      //   "./src/styles/custom.css",
      // ],
      title: "FR",
      plugins: [
        // ion(),

        //pagePlugin(),
        // starlightImageZoom(),
        // starlightUtils({
        //   multiSidebar: true,
        // }),

      ],
      // expressiveCode: {
      //   themes: ["tokyo-night"],
      // },
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
            { slug: 'cosinus/tst' },
            { label: "Source code  ", link: "https://github.com/FilipRuman/cosinus" }, 
          ],
        },
        {
          label: "c parser",
          items: [

            { slug: 'parser/preamble' },
            { slug: 'parser/setup' },
            { slug: 'parser/lexer' },
            { slug: 'parser/basic_parser' },



          { label: "Source code  ", link: "https://github.com/FilipRuman/RIP" }, 
          ]
        },
      ],
    }),
  ],
});
