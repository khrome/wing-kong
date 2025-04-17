wing-kong imports
=================

Because writing importmaps and maintaining them by hand when you're doing native module development is pointless and infuriating, and the use case for this is super basic: You want to deliver from one or more CDNs on a site that allows file hosting via URL, but does not allow dependency insallation (ex: [gh-pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)) and another which you want to be locally hosted (like a browser test suite or a static local dev server).

This makes that simple: pulling dependencies, then rendering importmaps based on your configuration. The basic profile & generate runs client + server, though the CL tools only run server side.

UPDATE: `wing-kong` now supports loading in the browser and additionally building an importmap from a root `package.json` using either your `/node_modules` a CDN or a fusion of multiple sources.

Usage
-----

> "You think they'd let us walk in and out like the wind?"
>           -Wang Chi


To use it as a build tool within your project:

1) Add it to your project

- install with npm 
    ```bash
        npm i wing-kong
    ```

2) Add the generator to your scripts:

- in your package.json

    ```json
        {
            "scripts": {
                "regenerate-test-importmap" : "wing-kong -i .import-config.json -f ./test/test.html rewrite dependencies",
                "generate-importmap" : "wing-kong -i .import-config.json generate dependencies"
            }
        }
    ```
    
- in your import-endpoints.json
    
    ```json
        {
            "unpkg" : "https://unpkg.com/${name}${version}/",
            "jsdeliver" : "https://cdn.jsdelivr.net/npm/${name}${version}/",
            "local" : "./node_modules/${name}"
        }
    ```
    
- When you generate `generate-public-importmap` it will use `unpkg` (falling back to `jsdeliver` then `local`). Because it doesn't use an import map, `generate-importmap` defaults to your local node_modules, assuming you are running a local server.

3) If you want to further automate: 

- you could add it to your [git hooks](https://github.com/toplenboren/simple-git-hooks/)

    ```bash
        npm install simple-git-hooks
    ```
    
- Then add a hook to regenerate these files on merge, so any deps changes come in and any cross branch merging gets normalized.

    ```json
        {
            "simple-git-hooks" : {
                "post-merge" : " if [[ \"$(git rev-parse --abbrev-ref HEAD)\" == \"gh-pages\" ]]; then npm run generate-public-importmap; else npm run generate-importmap; fi"
            }
        }
    ```
    
Roadmap
-------

> "Indeed!"
> -Lo Pan

- [x] - browser config generation
- [ ] - windows safety (remove unsafe unix to web path conversion)
- [ ] - support legacy configs
- [ ]     - `.files`
- [ ]     - vite compilation of individual deps
- [ ] - browser: inline generation

Testing
-------

> "As two... I said I was coming"
> -Jack Burton

Run the bin tests to test the commandline executable
```bash
npm run bin-test
```

Run the es module tests to test the root modules
```bash
npm run import-test
```
to run the same test inside the browser:

```bash
npm run browser-test
```
to run the same test headless in chrome, firefox and safari:
```bash
npm run headless-browser-test
```

to run the same test inside docker:
```bash
npm run container-test
```

Credit
------
The Quotes and name are from the ever excellent [Big Trouble in Little China](https://www.youtube.com/watch?v=592EiTD2Hgo) which began life as a sequel script to the equally excellent [Adventures of Buckaroo Banzai](https://www.youtube.com/watch?v=RdanCNK4ayo).