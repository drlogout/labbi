var phantom = require('phantom');
var async = require('neo-async');
var fs = require('fs');
var _ = require('lodash');
var url = require('url');
var winston = require('winston');
var Entities = require('html-entities').XmlEntities;
entities = new Entities();

var proto = {

  crawlPage: function crawlPage(pageUrl, callback) {

    var that = this;

    phantom.create(function (ph) {
      ph.createPage(function (page) {
        page.open(pageUrl, function (status) {
          winston.log('debug', pageUrl);
          winston.log('debug', status);
          if (status === 'fail') {
            callback('Can\'t crawl ' + pageUrl);
            return ph.exit();
          }
          page.includeJs('http://ajax.googleapis.com/ajax/libs/jquery/1.8.2/jquery.min.js', function () {

            page.evaluate(function (baseUrl) {
                var links = [];
                $('a[href^="' + baseUrl + '"], a[href^="/"]').each(function () {
                  links.push($(this).attr('href'));
                });
                return links;
              },
              function (links) {
                callback(null, links);
                ph.exit();
              }, url.format(that.config.baseUrl));
          });
        });
      });
    });

  },

  setSiteUrl: function setSiteUrl(uri) {

    if (uri.charAt(uri.length - 1) === '/') {
      uri = uri.substring(0, uri.length - 1);
    }

    if (!this.siteUrls[uri]) {
      this.siteUrls[uri] = {
        lastUpdated: new Date().getTime()
      }
      return true;
    }
    return false;
  },

  recursiveCrawl: function recursiveCrawl(uri) {

    uri = uri || url.format(this.config.baseUrl);

    var uriObj = url.parse(uri);
    var tmpObj;
    var that = this;

    if (!uriObj.host) {

      tmpObj = uriObj;
      uriObj = _.extend({}, this.config.baseUrl);
      uriObj.pathname = tmpObj.pathname;
      uriObj.search = tmpObj.search;
      uri = url.format(uriObj);

    }

    if (this.setSiteUrl(uri)) {
      this.q.push(uri, function (err, links) {
        if (err) {
          return winston.log('debug', err);
        }
        links.forEach(function (link) {
          this.recursiveCrawl(link);
        }, that);
      });
    }

  },

  createSitemap: function createSitemap(urls) {

    var sitemap;
    Object.keys(urls).forEach(function (key, index, array) {
      if (index === 0) {
        return sitemap = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
      }
      sitemap += '<url><loc>' + entities.encode(key) + '</loc></url>';
      if (index === array.length - 1) {
        sitemap += '</urlset>';
      }

    });

    fs.writeFile(this.config.sitemapPath, sitemap, function (err) {
      if (err) {
        winston.log('debug', err)
      }
      winston.log('info', 'Sitemap created!')
    })

  },


  setConfig: function setConfig(initConfig) {
    this.config = _.extend(this.config, initConfig);
    this.config.baseUrl = url.parse(this.config.baseUrl);
    winston.level = this.config.logLevel;
  },

  updateSitemap: function updateSitemap() {

    this.siteUrls = Object.create(null);

    winston.log('info', 'creating sitemap');

    if (!this.config.baseUrl || !this.config.sitemapPath) {
      return winston.log('info', 'config missing');
    }
    this.recursiveCrawl();

  }

};


module.exports = function(){

  var sitemapGenerator = Object.create(proto);
  sitemapGenerator.config = {
    logLevel: 'info'
  };

  sitemapGenerator.q = async.queue(function (link, callback) {
    sitemapGenerator.crawlPage.call(sitemapGenerator, link, function (err, links) {
      callback(err, links);
    });
  });

  sitemapGenerator.q.drain = function () {
    sitemapGenerator.createSitemap(sitemapGenerator.siteUrls);
  };

  return sitemapGenerator;

};