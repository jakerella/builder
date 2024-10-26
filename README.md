# Builder

A simple static site builder using [Handlebars for templating](https://handlebarsjs.com/). Very lightweight, and without too many features.

## Usage

1. Install the builder:

`npm install git+https://github.com/jakerella/builder.git`

2. Create your build config (`build.json`) in your project's root directory:

```json
{
    "destination": "build/",  // where the built files will go (should be empty or not exist yet)
    "clean": true,  // whether or not to remove the destination directory before starting
    "default_layout": "basic",  // the name (filename without extension) of the default Handlebars layout pages should use
    "layouts_loc": "layouts/",  // the directory path for all Handlebars layouts
    "partials_loc": "layouts/partials/",  // the directory path for all Handlebars partials (header, footer, nav, etc)
    "pages_loc": "pages/",  // the directory path for all content pages
    "static_copy": [
        // An array of things to copy into the destination directory as-is (like CSS, client side JS, etc)
        { "source": "assets/", "dest": "" }
    ]
}
```

3. Create your project structure and some starter files, it might look like this:

```
my-project/
  |_ assets/
    |_ main.css
  |_ layouts/
    |_ partials/
      |_ header.hbs
      |_ footer.hbs
    |_ basic.hbs
    |_ profile.hbs
  |_ pages/
    |_ index.html
    |_ profile.html
    |_ work-projects.html
```

4. Run the build: `node build`

> If you aren't using the default config file (`build.json` in the project root) then you need to specify the config file: `node build build.json`

5. Serve up the destination directory:

You can use a simple HTTP server like Node's `http-server`. If you use the default destination and install http-server globally, the command would be:

`http-server build/`

And you can access your site at: `127.0.0.1:3000`
