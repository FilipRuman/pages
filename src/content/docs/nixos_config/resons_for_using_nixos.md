---
title: Reasons to use NixOS
description: Features that makes NixOS the best linux distribution and my story trying linux.
---

If you are considering switching to NixOS, you are in the right place. In this
tutorial I will treat **NixOS**, the **Nix package manager**, and **Nix
language** as closely related entities, since they are well and tightly
integrated in practice. The Nix package manager can be used standalone but it is
just one of the parts that overall make NixOS a great OS.

## Worst Parts of NixOS

### Very Steep Learning Curve

I would not recommend NixOS to someone without software development experience.
While the configuration system is intuitive for programmers, it can seem
daunting to newcomers.

### Long Initial Setup for Experienced Users

If you already have a working configuration on another Linux distribution, there
are two key points to consider:

- You have already completed the hardest part: understanding what needs to be
  configured.
- Translating your existing setup into NixOS may take significant time. I
  recommend starting from a Nix configuration that roughly matches your desired
  setup and modifying to your needs.

### You Can't Go Back

NixOS, like other high-quality productivity tools, has a “once you try it, you
can’t go back” effect. Once you become accustomed to features such as Neovim, a
minimal ergonomic keyboard, a tiling/scrolling window manager, or a modern
programming language, returning back to 'NORMAL' and 'INTUITIVE FOR MOST PEOPLE'
tools is just painful.

## Best NixOS Features

### Updates

NixOS primarily uses
[two separate package channels](https://nixos.wiki/wiki/Nix_channels), which
allow it to serve two distinct user groups: those who prioritize stability above
all else, and those who prefer access to the latest, cutting-edge features.

> [Stable channels (nixos-25.11) provide conservative updates for fixing bugs
and security vulnerabilities, but do not receive major updates after initial
release. New stable channels are released every six months.](https://nixos.wiki/wiki/Nix_channels)
>
> [Unstable channels (nixos-unstable, nixpkgs-unstable) correspond to the main
development branch (unstable) of Nixpkgs, delivering the latest tested updates
on a rolling basis.](https://nixos.wiki/wiki/Nix_channels)

### Stability

Based on my nearly three years of daily use of NixOS on the unstable branch, the
most common issue is that sometimes a package fails to compile. This problem
only occurs on the unstable branch and can block the OS update process. If you
prefer not to contribute to resolving the issue, it can usually be ignored
temporarily; most failures are fixed within about a week.

As with any package manager, occasional regressions can occur. For example, I
recently encountered an issue with [SDDM](https://github.com/sddm/sddm)
completely not working. NixOS provides a straightforward way to handle these
situations: you can rollback to a previous system generation. When a regression
occurs, simply submit an issue to the package repository, rollback to the last
working generation, and continue with your business as usual.

### Documentation

The [NixOS wiki](https://nixos.wiki) is an excellent learning resource that
provides high quality information for most popular use-cases. Many Linux
programs also include NixOS-specific instructions due to its popularity. You can
always use information made for other distros,
[arch wiki](https://wiki.archlinux.org/title/Main_page) is great for general
Linux topics.

### Packages

[NixOS has the largest package repository in the world](https://repology.org/repository/nix_unstable).
If this wasn't sufficient you can install flatpaks declaratively with
[Nix-flatpak](https://filip-ruman.pages.dev/nixos_config/usefull_flakes/#nix-flatpak)
or run standard Linux executables with the `steam-run`.

### Easy Customization

Installing any piece of software is straightforward. For example, you can set up
KDE Plasma along with additional applications by copying a default configuration
directly from the NixOS wiki.

```nix
services = {
  desktopManager.plasma6.enable = true;
  displayManager.sddm.enable = true;
  displayManager.sddm.wayland.enable = true;
};

environment.systemPackages = with pkgs; [
  # KDE Utilities
  kdePackages.discover # Optional: Software center for Flatpaks/firmware updates
  kdePackages.kcalc # Calculator
  kdePackages.kcharselect # Character map
  kdePackages.kclock # Clock app
  kdePackages.kcolorchooser # Color picker
  kdePackages.kolourpaint # Simple paint program
  kdePackages.ksystemlog # System log viewer
  kdePackages.sddm-kcm # SDDM configuration module
  kdiff3 # File/directory comparison tool
  
  # Hardware/System Utilities (Optional)
  kdePackages.isoimagewriter # Write hybrid ISOs to USB
  kdePackages.partitionmanager # Disk and partition management
  hardinfo2 # System benchmarks and hardware info
  wayland-utils # Wayland diagnostic tools
  wl-clipboard # Wayland copy/paste support
  vlc # Media player
];
```

Disabling it is as simple as commenting this out or not importing module with
this configuration. Installing and customizing most of the software on NixOS is
as easy as this. You can also use
[Home-Manager](https://nix-community.github.io/home-manager/) to manage all the
dot-configs on all of your system reliably and declaratively.

### Automatic 'System Backups'

This process is so fast that I can install NixOS form scratch using a live ISO
on my desktop within 20 minutes. NixOS makes it so easy because I just need to
clone my config from public GitHub repo(I don't need to even log into anything)
and rebuild my system. You can even do this remotely through ssh with

NixOS reduces the risk of a system becoming unusable by storing previous
generations. If you encounter a fatal regression, you can simply rollback to an
earlier generation. You can also use [Btrfs](https://nixos.wiki/wiki/Btrfs) to
store system snapshots, as is recommended on other distributions. Personally, I
find this unnecessary in NixOS due to its built-in rollback functionality.

:::danger[Remember]

**Always** follow the **3-2-1 backup** rule when handling **mission critical**
data. This strategy recommends keeping **three** copies of your data, on **two**
different types of media, with **one** copy stored off-site.

:::

### Quick Setup on a New Machine

[My guide on installing my complete NixOS configuration with a single command is
available here](https://filip-ruman.pages.dev/nixos_config/quick_installation/).
This process is so fast that I can install NixOS from scratch using a live ISO
on my desktop in approximately 20 minutes. NixOS simplifies this by allowing you
to clone your configuration directly from a public GitHub repository(no login
required)and rebuild the system. You can even perform this installation remotely
via SSH using [nixos-anywhere](https://github.com/nix-community/nixos-anywhere).
