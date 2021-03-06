define(['jquery', 'underscore', './ModuleConfig', './PackageParser', './workers/WorkerProxy', 'StorageManager', 'i18nStrings', 'URIjs', './EpubLibraryOPDS', 'readium_js/epub-fetch/publication_fetcher', 'pouchdb', 'papaparse', 'readium_js/epub-fetch/Utils'], function ($, _, moduleConfig, PackageParser, WorkerProxy, StorageManager, Strings, URI, EpubLibraryOPDS, PublicationFetcher, PouchDB, Papa, Utils) {

    var LibraryManager = function(){
    };

    var libraryDB = new PouchDB('librarydb');
    var categoryIndexDB = new PouchDB('categorydb');

    var adjustEpubLibraryPath = function(path) {

        if (!path || !moduleConfig.epubLibraryPath) return path;

        var pathUri = undefined;
        try {
            pathUri = new URI(path);
        } catch(err) {
            console.error(err);
            console.log(path);
        }

        if (pathUri && pathUri.is("absolute")) return path; // "http://", "https://", "data:", etc.

        if (path.indexOf("epub_content/") == 0) {
            path = path.replace("epub_content/", "");
        }

        var parts = moduleConfig.epubLibraryPath.split('/');
        parts.pop();

        var root = parts.join('/');
        path = root + (path.charAt(0) == '/' ? '' : '/') + path;

        return path;
    };

    function fetchEpubMetadataDB(path) {
      var promise = libraryDB.get(path)
      .catch(function () {
        return {};
      });

      return Utils.deferizePromise(promise);
    }

    function fetchEpubMetadataFS(path) {
      var publicationFetcher = new PublicationFetcher(path, null, window);

      return Utils.deferize(publicationFetcher.initialize).call(publicationFetcher)
      .then(function () {
        return Utils.deferize(publicationFetcher.getPackageDom).call(publicationFetcher);
      })
      .then(function (packageDom) {
        return _.chain(PackageParser.parsePackageDom(packageDom))
          .pick('author', 'title', 'coverHref')
          .extend({ rootUrl: path })
          .value();
      });
    }

    function persistEpubMetadata(epubData) {
      epubData._id = epubData.rootUrl;

      var promise = libraryDB.get(epubData._id)
      .catch(function () {
        return {};
      })
      .then(function (doc) {
        _.defaults(epubData, doc);

        return libraryDB.put(epubData);
      })
      .catch(function () {
        return {};
      })
      .then(function () {
        return epubData;
      });

      return Utils.deferizePromise(promise);
    }

    function fetchEpubMetadata(path) {
      return fetchEpubMetadataDB(path)
      .then(function (epub) {
        if (!epub.title) {
          return fetchEpubMetadataFS(path)
          .then(function (epubData) {
            return persistEpubMetadata(epubData);
          });
        }

        return epub;
      })
      .then(function (epub) {
        if (!epub.coverHref) {
          return epub;
        }

        var coverHref = epub.coverHref;
        epub.coverHref = null;

        epub.coverLoad = function () {
          var publicationFetcher = new PublicationFetcher(path, null, window);
          return Utils.deferize(publicationFetcher.initialize).call(publicationFetcher)
          .then(function () {
            // TODO: setPackageMetadata is needed to initialize
            // the EncryptionHandler -- etsakov@2017.11.24
            return Utils.deferize(publicationFetcher.setPackageMetadata)
            .call(publicationFetcher, { id: '' });
          })
          .then(function () {
            //TODO: extract image from html if needs be - jorro@2017.12.04
            return Utils.deferize(publicationFetcher.relativeToPackageFetchFileContents)
            .call(publicationFetcher, coverHref, 'blob');
          })
          .then(function (imageBlob) {
            epub.coverHref = window.URL.createObjectURL(imageBlob);
            return epub;
          });
        };

        return epub;
      });
    }

    function digestIndexCSV(file) {
      var deferred = $.Deferred();

      var epubs = [];

      Papa.parse(file, {
        skipEmptyLines: true,
        step: function (row) {
          var data = row.data[0];
          var filename = data[0];
          var rootUrl = 'file:///sdcard/eKitabu/' + filename;
          var grades = data[1].split(/\s*;\s*/);
          var subjects = data[2].split(/\s*;\s*/);
          var categories = grades.concat(subjects);

          var epub = { _id: rootUrl, rootUrl, categories, grades, subjects };

          if (epub._id) {
            epubs.push(epub);
          }
        },
        complete: function () {
          var promises = _.chain(epubs)
          .uniq('_id')
          .map(function (epub) {
            var promise = libraryDB.get(epub._id)
            .catch(function () {
              return {};
            })
            .then(function (doc) {
              _.extendOwn(doc, epub);
              return libraryDB.put(doc);
            })
            .catch(function() {
              return {};
            });

            return Utils.deferizePromise(promise);
          })
          .value();

          $.when.apply($, promises).then(function() {
              deferred.resolve();
          });
        }
      });

      return deferred.promise();
    }

    function buildCategoryIndex(entries) {
      var promise = categoryIndexDB.allDocs({include_docs: true})
      .then(function (result) {
        return _.map(result.rows, 'doc');
      })
      .then(function (docs) {
        return _.reject(entries, function (entry) {
          return _.some(docs, { _id: entry.name });
        });
      });

      return Utils.deferizePromise(promise)
      .then(function (entries) {
        return _.reduce(entries, function (acc, entry) {
          return acc.then(function () {
            return Utils.deferize(entry.file)
              .call(entry)
              .then(function (file) {
                return digestIndexCSV(file);
              })
              .then(function () {
                return Utils.deferizePromise(categoryIndexDB.put({ _id: entry.name }));
              });
          });
        }, $.Deferred().resolve())
      });
    }

    function getAllGradesToSubject(epubs, grades) {
      var allGradesToSubjects = {};
      _.each(grades, function(grade) {
        allGradesToSubjects[grade] = [];
      });
      _.each(epubs, function(epub) {
        _.each(epub.grades, function(grade){
          allGradesToSubjects[grade] = _.union(allGradesToSubjects[grade], epub.subjects);
        })
      });
      _.chain(allGradesToSubjects)
        .values()
        .each(function(gradeToSubjects) {
          gradeToSubjects.sort();
      });
      return allGradesToSubjects;
    }

    LibraryManager.prototype = {

       _getFullUrl : function(packageUrl, relativeUrl){
            if (!relativeUrl){
                return null;
            }

            var parts = packageUrl.split('/');
            parts.pop();

            var root = parts.join('/');

            return root + (relativeUrl.charAt(0) == '/' ? '' : '/') + relativeUrl
        },

        // TODO: see disabled usage in EpubLibrary.js
        // resetLibraryData: function() {
        //     this.libraryData = undefined;
        // },

        retrieveAvailableEpubs : function(success, error){
          var self = this;
          if (self.libraryData) {
              success(self.libraryData);
              return;
          }

          var libraryPath = 'file:///sdcard/eKitabu/';

          Utils.deferize(cordova.plugins.permissions.requestPermission)
          .call(null, cordova.plugins.permissions.READ_EXTERNAL_STORAGE)
          .then(function (status) {
            if (!status.hasPermission) {
              return $.Deferred().reject('Failed to obtain READ_EXTERNAL_STORAGE permission');
            }

            return Utils.deferize(resolveLocalFileSystemURL)
              .call(null, libraryPath);
          })
          .then(function (dir) {
            var reader = dir.createReader();
            return Utils.deferize(reader.readEntries)
              .call(reader);
          })
          .then(function (entries) {
            var csvs = _.filter(entries, function (entry) {
              return entry.name.endsWith('.csv');
            });

            buildCategoryIndex(csvs).then(function () {
              var epubPromises = _.chain(entries)
              .filter(function(entry) {
                return entry.name.endsWith('.epub');
              })
              .map(function(entry) {
                // entry.nativeURL encodes whitespaces -- etsakov@2017.11.13
                return fetchEpubMetadata('file://' + entry.fullPath);
              })
              .value();

              $.when.apply($, epubPromises).then(function() {
                var epubs = arguments;
                var grades = _.chain(epubs).map('grades').flatten().unique().compact().sortBy().value();

                self.libraryData = {
                  epubs: epubs,
                  allGrades : grades,
                  gradesToSubjects : getAllGradesToSubject(epubs, grades)
                };

                success(self.libraryData);
              });
            });
          })
          .fail(function (err) {
            console.error(err);
            error && error(err);
          });
        },
        deleteEpubWithId : function(id, success, error){
            WorkerProxy.deleteEpub(id, this.libraryData, {
                success: this._refreshLibraryFromWorker.bind(this, success),
                error: error
            });
        },
        retrieveFullEpubDetails : function(packageUrl, rootUrl, rootDir, noCoverBackground, success, error){
            var self = this;

            $.get(packageUrl, function(data){

                if(typeof(data) === "string" ) {
                    var parser = new window.DOMParser;
                    data = parser.parseFromString(data, 'text/xml');
                }
                var jsonObj = PackageParser.parsePackageDom(data, packageUrl);
                jsonObj.coverHref = jsonObj.coverHref ? self._getFullUrl(packageUrl, jsonObj.coverHref) : undefined;
                jsonObj.packageUrl = packageUrl;
                jsonObj.rootDir = rootDir;
                jsonObj.rootUrl = rootUrl;
                jsonObj.noCoverBackground = noCoverBackground;

                success(jsonObj);

            }).fail(error);
        },
        _refreshLibraryFromWorker : function(callback, newLibraryData){
            this.libraryData = newLibraryData;
            callback();
        },
        handleZippedEpub : function(options){
            WorkerProxy.importZip(options.file, this.libraryData, {
                progress : options.progress,
                overwrite: options.overwrite,
                success: this._refreshLibraryFromWorker.bind(this, options.success),
                error : options.error
            });
            //Dialogs.showModalProgress()
            //unzipper.extractAll();
        },
        handleDirectoryImport : function(options){

            var rawFiles = options.files,
                files = {};
            for (var i = 0; i < rawFiles.length; i++){
                 var path = rawFiles[i].webkitRelativePath
                // don't capture paths that contain . at the beginning of a file or dir.
                // These are hidden files. I don't think chrome will ever reference
                // a file using double dot "/.." so this should be safe
                if (path.indexOf('/.') != -1){
                    continue;
                }
                var parts = path.split('/');

                parts.shift();
                var shiftPath = parts.join('/');

                files[shiftPath] = rawFiles[i];
            }

            WorkerProxy.importDirectory(files, this.libraryData, {
                progress : options.progress,
                overwrite: options.overwrite,
                success: this._refreshLibraryFromWorker.bind(this, options.success),
                error : options.error
            });
        },
        handleUrlImport : function(options){
            WorkerProxy.importUrl(options.url, this.libraryData, {
                progress : options.progress,
                overwrite: options.overwrite,
                success: this._refreshLibraryFromWorker.bind(this, options.success),
                error : options.error

            });
        },
        handleMigration : function(options){
            WorkerProxy.migrateOldBooks({
                progress : options.progress,
                success: this._refreshLibraryFromWorker.bind(this, options.success),
                error : options.error
            });
        },
        handleUrl : function(options){

        },
        canHandleUrl : function(){
            return moduleConfig.canHandleUrl;
        },
        canHandleDirectory : function(){
            return moduleConfig.canHandleDirectory;
        }
    }

    window.cleanEntireLibrary = function(){
        StorageManager.deleteFile('/', function(){
            console.log('done');
        }, console.error);
    }
    return new LibraryManager();

});
