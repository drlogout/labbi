
Work in progress.

## Generating sitemap

```
var labbi = require('labbi');

var eddie = labbi();

eddie.setConfig({
    logLevel: 'debug',
    baseUrl: 'http://example.com',
    sitemapPath: 'LOCAL PATH TO SITEMAP.XML'
});

eddie.updateSitetmap();


```