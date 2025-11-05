// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { ion } from "starlight-ion-theme";
// https://astro.build/config
export default defineConfig({
  site: "https://filipruman.github.io",
  base: "/pages",
  integrations: [
    starlight({
      customCss: [
        // Relative path to your @font-face CSS file.
        "./src/fonts/font-face.css",
        "./src/styles/custom.css",
      ],
      title: "FR",
      plugins: [ion()],
      expressiveCode: {
        themes: ["tokyo-night"],
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
          label: "Guides",
          items: [
            // Each item here is one entry in the navigation menu.
            { label: "Example Guide", slug: "guides/example" },
          ],
        },

        {
          label: "simple parser in rust",
          autogenerate: { directory: "writing a simple parser in rust" },
        },
      ],
    }),
  ],
});
