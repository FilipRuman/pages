---
title: 3. Useful Flakes
description: Level up your NixOS config with those few simple tools. Learn how to use Nix-Flatpak, Steam-Config-Nix and NVF to make your life easier.
---

## [Nix-Flatpak](https://github.com/gmodena/nix-flatpak)

> Declarative flatpak manager for NixOS inspired by declarative-flatpak and
> nix-darwin's homebrew module.

We can just write and import a simple module like this:

```nix
{inputs, ...}: {
  flake-file.inputs.nix-flatpak = {
    url = "github:gmodena/nix-flatpak";
  };

  flake.nixosModules.flatpak = {pkgs, ...}: {
    imports = [inputs.nix-flatpak.nixosModules.nix-flatpak];

    services.flatpak = {
      enable = true;
    };

    systemd.services.flatpak-repo = {
      wantedBy = ["multi-user.target"];
      path = [pkgs.flatpak];
      script = ''
        flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
      '';
    };
  };
}
```

And then we can just import any Flathub package at any place like this.

```nix
services.flatpak.packages = [
  "io.ente.auth"
  "com.brave.Browser"
  "com.discordapp.Discord"
  "org.gimp.GIMP"
];
```

`services.flatpak.packages` is a list so we can append it at many places and all
inputs will be merged. You can find IDs of all
[Flathub Flatpaks in here](https://flathub.org/en).To update all Flatpaks on
your system run: `flatpak update -y`

## [Steam-Config-Nix](https://github.com/different-name/steam-config-nix)

> Manage Steam launch options, compat tools and other local config declaratively
> through your nix config

```nix
{inputs, ...}: {
  flake-file.inputs.steam-config-nix = {
    url = "github:different-name/steam-config-nix";
    inputs.nixpkgs.follows = "nixpkgs";
  };
  flake.nixosModules.steam = {pkgs, ...}: {
    imports = [inputs.steam-config-nix.nixosModules.default];

    programs = {
      gamemode.enable = true;
      steam = {
        extraCompatPackages = with pkgs; [
          # proton-cachyos-x86_64-v4
          # proton-dw
          # proton-em
          proton-ge-bin
        ];
        protontricks.enable = true;
        package = pkgs.steam.override {
          extraProfile = ''
            export PROTON_ENABLE_WAYLAND=1
            export PROTON_ENABLE_HDR=1
          '';
        };

        gamescopeSession.enable = true;
        enable = true;
        localNetworkGameTransfers.openFirewall = true; # Open ports in the firewall for Steam Local Network Game Transfers
        config = {
          enable = true;
          closeSteam = true;
          defaultCompatTool = "GE-Proton";

          apps = {
            cyberpunk-2077 = {
              id = 1091500;
              compatTool = "GE-Proton";
              launchOptions = {
                env.WINEDLLOVERRIDES = "winmm,version=n,b";
                args = [
                  "--launcher-skip"
                  "-skipStartScreen"
                ];
              };
            };
          };
        };
      };
    };
  };
}
```

## [NVF](https://github.com/NotAShelf/nvf/tree/main)

> nvf is a highly modular, configurable, extensible and easy to use Neovim
> configuration in Nix. Designed for flexibility and ease of use, nvf allows you
> to easily configure your fully featured Neovim instance with a few lines of
> Nix.

You can check it out by running:\
`nix run github:notashelf/nvf`

This is the Neovim distribution I use myself. I migrated from a basic Neovim
config using Lua to this setup for two main reasons:

- **Easy package management** – NixOS handles packages very well, whereas Lazy &
  Mason are a pain in the ass to work with.
- **Easy LSP setup** – This was especially challenging before Neovim added
  native LSP support.

Enabling support for almost any language is as simple as adding the following to
your nvf config:

```nix
vim.languages.nix.enable = true;
```

If there is no built-in support for a feature, you can easily add it by
installing a standard Nix package and writing some Lua code in your config:

```nix
vim.luaConfigPre = '' lua code'';
```

You can check the [NVF documentation here](https://nvf.notashelf.dev/) . You can
checkout my personal config
[in here](https://github.com/FilipRuman/NNC/tree/main/modules/nvf)

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
        data-term="usefull flakes"
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
