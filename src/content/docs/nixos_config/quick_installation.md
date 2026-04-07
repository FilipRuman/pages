---
title: Quick NixOS Config Installation
description: Install your NixOS configuration with just one command. Clone from GitHub, set hostname, clean /etc/nixos, and deploy reproducible setups in minutes.
---

Ability to quickly and easily install your configuration is important for many
reasons. To accomplish this, we want to be able to copy the configuration,
remove unnecessary files, and create additional data with as few steps as
possible. You can even do this remotly thru ssh with
[nixos-anywhere](https://github.com/nix-community/nixos-anywhere)

:::note

You can also use a configuration straight from GitHub:\
`sudo nixos-rebuild switch --flake github:<owner>/<repo>#<hostname>`

I don’t recommend this because it makes it harder to modify your config. You
would have to push a new commit every time you try a change inside your
configuration.

:::

The easiest approach is to store your config on a public GitHub repository. This
allows us to clone your config without logging into any account. You can also
include any commands necessary for installation inside the README. If you don’t
want to use GitHub, there are many other ways to accomplish this.

First, we need to ensure that we are using the correct shell. Another
requirement is specifying the hostname. If your architecture is similar to mine,
your rebuild commands read the hostname from a file.

Snippet from my installation process:

```bash
bash
export host=<desktop/laptop/server>
```

Next, we need to clean any unnecessary files inside `/etc/nixos/`. This can be
done simply with:

```bash
sudo rm -rf /etc/nixos 
mkdir /etc/nixos/
```

Then, if needed, we can add the `$host` data to the `/etc/nixos/host.txt` file.

I also create an `onUpdate.sh` file, which is used to run various tasks when
updating the system.

Next, clone the repository that contains your configuration. For me, this is:
`sudo git clone https://github.com/FilipRuman/NNC.git`

Finally, switch to the new config using:
`sudo nixos-rebuild switch --upgrade --flake ".#$host"`

Snippet from my installation process:

```bash
sudo rm -rf /etc/nixos 
mkdir /etc/nixos/
cd /etc/nixos || exit
sudo echo "$host" >./host.txt
# On update file
touch onUpdate.sh
sudo chmod +x onUpdate.sh
sudo git clone https://github.com/FilipRuman/NNC.git
cd ./NNC/ || exit
sudo nixos-rebuild switch --upgrade --flake ".#$host"
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
        data-term="quick installation"
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
