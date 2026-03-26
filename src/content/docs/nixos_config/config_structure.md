---
title: 1. Config Structure
description: Config Structure
---

Generally speaking, it doesn’t matter how your configuration is structured. It’s
the same as with programming: if you have a small project, the structure doesn’t
matter. However, over time your configuration will certainly grow larger and
larger (especially if you have multiple machines).

The configuration structure that I recommend most is called the “Dendritic
pattern”. It allows you to remove most of the boilerplate and write reusable
configurations that can be used across multiple machines.

If you want an example of a working configuration you can look at
[my configuration](https://github.com/FilipRuman/NNC) or one of:

- [Doc-Steve's configuration](https://github.com/Doc-Steve/dendritic-design-with-flake-parts/tree/main/modules)
- [Vimjoyer's configuration](https://github.com/vimjoyer/nixconf)

I highly recommend those sources if you want to know more about this:

- [Vimjoyer's video](https://www.youtube.com/watch?v=-TRbzkw6Hjs)
- [Dendritic design GitHub repo](https://github.com/Doc-Steve/dendritic-design-with-flake-parts)
- [Ultimate NixOS Desktop: Niri, Noctalia Shell, and the Dendritic Pattern | Full Setup](https://www.youtube.com/watch?v=aNgujRXDTdE)

## Basic Setup

To create a very basic dendritic-pattern project use this command:
`nix flake init -t github:vic/flake-file#dendritic`. I recommend creating it
inside a Git directory under `/etc/nixos/`. By using Git, you will be able to
easily sync your config with other devices and store it safely.

:::danger

Most of the "random" or "weird" errors I encountered when working with nix
config were caused by git. If files in a subdirectory aren't "visiblel" when you
rebuild your config, it is probably because this directory isn't included inside
your Git tree. I like to use
[lazy git](https://github.com/jesseduffield/lazygit) for this.

:::

```bash
.
├── flake.nix
└── modules
    ├── audio.nix
    ├── fish.nix
    ├── hyprland.nix
    ├── otherExampleMoudule.nix
    └── hosts
        └── $host
            ├── $host.nix
            └── hwConfig.nix
```

This shows a basic structure of a dendritic design config. The core of it was
already created by the previous command. All the Nix files inside the
`./modules/` directory, will be imported automatically by the
[import tree flake](https://github.com/vic/import-tree), unless you prefix a
file or directory name with an underscore (_name).

## Host Modules

Under the `modules` directory create a `hosts` subdirectory.\
Config that allow specific machines to behave in particular ways ways will go
there. This allows for configuring multiple machines using the same project as a
config.

:::tip[example]

Your home lab doesn't have to have Hyprland installed on it(you SSH onto it),
but your laptop does. This will be also true for other configuration files, for
example:

- Hardware config
- Display config(different resolution)
- Mouse sensitivity.

:::

Create another directory named after your host(`laptop`, `desktop`, `homeLab`,
etc.). I will reference it as `$host` through this tutorial.

Inside the `$host.nix` file:

```nix
### ./modules/host/$host/$host.nix

{
  inputs,
  self,
  lib,
  ...
}: {
  flake = {
    # Declare $host machine
    nixosConfigurations.$host = inputs.nixpkgs.lib.nixosSystem {
      modules = with self.nixosModules; [
        $host
        #hyprland
        otherExampleMoudule
        fish
      ];
    };

    # module for additional configuration 
    nixosModules.$host = {pkgs, ...}: {
      environment.systemPackages = with pkgs; [
        blender
      ];
    };
  };
}
```

`nixosConfigurations.$host = inputs.nixpkgs.lib.nixosSystem` will allow us to

run: `sudo nixos-rebuild switch --upgrade --flake .#$host"` to use certain host
file as a config on a `$host` machine. Inside the
`inputs.nixpkgs.lib.nixosSystem` configuration you can import any of your
modules. Example of this is the `flake.nixosModules.$host` module created in the
previous snippet.

### Hardware Config

Next, you need to move your `hardware-config.nix` from
`/etc/nixos/hardware-config.nix` to `./modules/host/$host/hw-config.nix`. This
configuration file is required for NixOS to work with your hardware.

The only change you need to make is wrapping it in a flake parts module:
`flake.nixosModules.$host`. It should have the same name as the module inside
the `$host.nix`. This causes the flake-file to automatically merge their
contents, so we don't have to import these two modules separately.

This is how my hw-config looks:

:::danger

Do not copy **MY** config, it will **100% MAKE YOUR OS UNBOOTABLE**!

:::

```nix
{
  flake.nixosModules.desktop = {
    config,
    lib,
    modulesPath,
    ...
  }: {
    imports = [
      (modulesPath + "/installer/scan/not-detected.nix")
    ];

    boot.initrd.availableKernelModules = ["nvme" "xhci_pci" "ahci" "usbhid" "usb_storage" "sd_mod"];
    boot.initrd.kernelModules = [];
    boot.kernelModules = ["kvm-amd"];
    boot.extraModulePackages = [];

    fileSystems."/" = {
      device = "/dev/disk/by-uuid/bac8161a-fcc7-465d-9944-549efd76e1a0";
      fsType = "ext4";
    };

    boot.initrd.luks.devices."luks-9c6c352a-9681-4e52-885f-3a33e9ce92fe".device = "/dev/disk/by-uuid/9c6c352a-9681-4e52-885f-3a33e9ce92fe";

    fileSystems."/boot" = {
      device = "/dev/disk/by-uuid/2BB5-71EB";
      fsType = "vfat";
      options = ["fmask=0077" "dmask=0077"];
    };
    environment.etc."crypttab".text = ''
      data_crypt UUID=e30f59fc-0341-4b86-8cfe-8084ff2a8c1d /root/keys/data.key luks
    '';

    fileSystems."/data" = {
      device = "/dev/mapper/data_crypt";
      fsType = "ext4";
    };

    # swapDevices =
    #   [ { device = "/dev/disk/by-uuid/f923d65d-a077-43e4-9d5e-b9bb33be36f7"; }
    #   ];

    # Enables DHCP on each ethernet and wireless interface. In case of scripted networking
    # (the default) this is the recommended approach. When using systemd-networkd it's
    # still possible to use this option, but it's recommended to use it in conjunction
    # with explicit per-interface declarations with `networking.interfaces.<interface>.useDHCP`.
    networking.useDHCP = lib.mkDefault true;
    # networking.interfaces.enp14s0.useDHCP = lib.mkDefault true;
    # networking.interfaces.wlp13s0.useDHCP = lib.mkDefault true;

    nixpkgs.hostPlatform = lib.mkDefault "x86_64-linux";
    hardware.cpu.amd.updateMicrocode = lib.mkDefault config.hardware.enableRedistributableFirmware;
  };
}
```

## Example Modules

Here are some example NixOS modules, taken directly from my personal config:

### 1. Enable NVIDIA GPU Support

```nix
### ./modules/nvidia.nix
{
  flake.nixosModules.nvidia = {
    # Enable OpenGL
    hardware.graphics = {
      enable = true;
    };

    #For nixos-unstable, they renamed it
    services.xserver.enable = true;
    services.xserver.videoDrivers = ["nvidia"];

    hardware.nvidia = {
      modesetting.enable = true;
      powerManagement.enable = true;
      # Fine-grained power management. Turns off GPU when not in use.
      # Experimental and only works on modern Nvidia GPUs (Turing or newer).
      powerManagement.finegrained = false;

      # Enable the Nvidia settings menu,
      # accessible via `nvidia-settings`.
      nvidiaSettings = true;

      open = true;
    };
  };
}
```

### 2. Docker with NVIDIA GPU Passthrough Support

```nix
### ./modules/docker.nix
{
  flake.nixosModules.docker = {pkgs, ...}: {
    hardware.nvidia-container-toolkit.enable = true;
    environment.systemPackages = with pkgs; [
      nvidia-container-toolkit
    ];
    virtualisation.docker = {
      enable = true;
      enableNvidia = true;
      daemon.settings.features.cdi = true;
      enableOnBoot = false; # enable by hand later with the command from hyprland
    };
  };
}
```

As explained before, you can import those modules by just writing their
names(eg. docker, nvidia) inside your host module:

```nix
nixosConfigurations.$host = inputs.nixpkgs.lib.nixosSystem {
  modules = with self.nixosModules; [
      nvidia
      docker
      # anythign other 
  ];
}
```

## Using Flake-File

Sometimes we need to use an external flake. An example use case is installing
programs that don’t have a standard package, or whose packages lack features
that the flake provides. One program for which I use an external flake is
[Zen Browser](https://zen-browser.app/).

```nix
{inputs, ...}: {
  flake-file.inputs.zen-browser = {
    url = "github:youwen5/zen-browser-flake";
    inputs.nixpkgs.follows = "nixpkgs";
  };
  flake.nixosModules.zen = {pkgs, ...}: {
    environment.systemPackages = [
      inputs.zen-browser.packages.${pkgs.stdenv.hostPlatform.system}.default
    ];
  };
}
```

Flake-files allow you to place `flake-file.inputs.$AnyNameForThisFlake` in any
module. Then you can use this flake’s properties in any of your modules by
referencing `inputs.$AnyNameForThisFlake`.\
This also allows you to override any part of the flake in the standard way
(e.g., set `inputs.nixpkgs.follows`).

You also need to remember to run: `sudo nix run .#write-flake` before rebuilding
your configuration. This adds any newly added flakes to your source flake
(`./flake.nix`). I personally run this command every time I rebuild my config so
I don’t forget.

## Home Manager Modules

[Home Manager](https://github.com/nix-community/home-manager) allows you to
reliably manage your dotfiles that configure all of your programs. See
[Vimjoyer’s video about Home Manager](https://www.youtube.com/watch?v=a67Sv4Mbxmc).

We can define Home Manager modules the same way we define NixOS modules using
flake-parts: `flake.homeModules.name`. I personally like to split Home Manager
modules into two types:

- **General** – needed on all of my machines: `flake.homeModules.general`
- **Machine-specific** – needed on a specific machine: `flake.homeModules.$host`

These modules automatically merge the contents of all files that have the
corresponding module type name. For example, I have only three Home Manager
modules: `desktop`, `laptop`, and `general`.

```nix
{
  flake.homeModules.general = {lib, ...}: {
    programs.ghostty.enable = true;
    programs.ghostty.settings = lib.mkForce {
      "background-opacity" = 0.9;
      "background-blur" = true;
      "clipboard-paste-protection" = false;
      "mouse-hide-while-typing" = true;
      "shell-integration" = "fish";
      "font-family" = "MesloLGM Nerd Font";
      "command" = "fish --login --interactive";
      "copy-on-select" = "clipboard";
    };
  };
}
```

### Making Home Manager Work

Now you need to change your `$host` module

```nix
### ./modules/host/$host/$host.nix

{
  inputs,
  self,
  lib,
  ...
}: {
  flake-file.inputs.home-manager = {
    url = lib.mkDefault "github:nix-community/home-manager";
    inputs.nixpkgs.follows = "nixpkgs";
  };

  imports = [
    inputs.home-manager.flakeModules.home-manager
  ];
  flake = {
    nixosConfigurations.$host = inputs.nixpkgs.lib.nixosSystem {
            ## nothing changed
    };

    nixosModules.$host = {pkgs, ...}: {

      imports = [
        inputs.home-manager.nixosModules.default
      ];

      home-manager.users.f = {
        imports = with self.homeModules; [
          $host
          general
        ];
        home = {
          stateVersion = "25.11";
          username = "$username";
          homeDirectory = "/home/$username";
        };
      };

      home-manager.backupFileExtension = "home-managebak";
    };
  };
}
```

This will import the Home Manager flake and set it up in a way that imports all
the Home Manager modules.

## Actually Using This Config

I really like having one command that does many things at once. Thats why I've
set up commands for updating my OS. This is very convenient - I just run one
command once a week and I can be sure that everything on my PC is up to date,
without having to worry about auto-updates (looking at you, Macroslop).

1. `rebuild` – quickly rebuilds my configuration. Useful when testing new
   settings or installing a new application.

2. `updateNix`
   - Sources the newest NixOS configuration for my machine, with the packages
     from the unstable branch.
   - Pulls any new git commits from the GitHub.
   - Removes old packages for backup system versions using
     `nix-collect-garbage`.
   - Runs any commands inside `/etc/nixos/onUpdate.sh` (useful for auto running
     tasks like updating Docker containers or performing other non-Nix tasks).

To make my update commands work on all of my machines, I put the hostname inside
`/etc/nixos/host.txt` so that my scripts can read it.

I use the
[unstable branch of NixOS](https://wiki.nixos.org/wiki/Channel_branches). The
main difference between the unstable and stable branches is that the unstable
branch follows a rolling release model. This means you don’t specify which
version of NixOS you are using — you always use the newest one. I prefer this
because I don’t want to worry about any NixOS versionning bullshit. When I run
the `updateNix` command, I want to always get the newest version of all programs
on my computer.

```nix
# for the fish shell
onUpdate = "sudo /etc/nixos/onUpdate.sh";
readHost = "set -g host (cat /etc/nixos/host.txt)";
rebuild = "readHost ; cd /etc/nixos/NNC/ ; sudo nix run .#write-flake ; sudo nixos-rebuild switch --upgrade --flake .#$host";
updateNix = "cd /etc/nixos/NNC/; git pull ; rebuild ; sudo nix flake update ; flatpak update -y ; onUpdate ; cleanup";
cleanup = "sudo nix-collect-garbage --delete-older-than 14d";
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
        data-term="config strucutre"
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
