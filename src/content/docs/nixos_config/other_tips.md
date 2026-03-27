---
title: Practical NixOS tips
description:Practical NixOS tips: screen recording with gpu-screen-recorder, fast screenshots via Grimblast in Hyprland, and importing local fonts into flakes.
---

## Recording

For screen recording I use
[gpu-screen-recorder](https://github.com/BrycensRanch/gpu-screen-recorder-git-copr)
with this command.

```bash
gpu-screen-recorder \
        -w screen \
        -f 60 \
        -o "$HOME/Videos/recording_$(date +%F_%H-%M-%S).mp4" &
```

For ending the recording I use: `pkill -f gpu-screen-recorder`. I have bind-ed
those commands to shortcuts inside the Hyprland.

## Screenshots

I use [Grimblast](https://github.com/hyprwm/contrib/tree/main/grimblast) with
shortcuts like this:

```nix
"Super, O, exec, grimblast -n copy area"
"Super Control_L, O, exec, grimblast -n edit area"
", Print, exec, grimblast copy area"
```

## Importing Fonts from Files:

I have some fonts that are not available as a native NixOS package. Because of
this I need to import them directly from a .ttf/.otf file. To do this I've
written this small module. The replace the `<GlobalPathToDirWithYourFontFiles>`
to make it work on your system.

```nix
{
  flake.nixosModules.fontsImport = {pkgs, ...}: let
    myLocalFonts = pkgs.runCommand "my-local-fonts" {} ''
      mkdir -p $out/share/fonts
      cp <GlobalPathToDirWithYourFontFiles>/*.{ttf,otf} $out/share/fonts/ || true
    '';
  in {
    fonts.packages = [
      myLocalFonts
    ];
  };
}
```

---

#### Bugs

If you find anything to improve in this project's code, please create an issue
describing it on the
[GitHub repository for this project](https://github.com/FilipRuman/NNC/issues).
For website-related issues, create an issue
[here](https://github.com/FilipRuman/pages/issues).

#### Support

All pages on this site are written by a human, and you can access everything for
free without ads. If you find this work valuable, please give a star to the
[GitHub repository for this project](https://github.com/FilipRuman/NNC).

<script src="https://giscus.app/client.js"
        data-repo="FilipRuman/NNC"
        data-repo-id="R_kgDOQ3xb7Q"
        data-category="Announcements"
        data-category-id="DIC_kwDOQ3xb7c4C4CG7"
        data-mapping="specific"
        data-term="other tips"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="top"
        data-theme="preferred_color_scheme"
        data-lang="en"
        data-loading="lazy"
        crossorigin="anonymous"
        async>
</script>
